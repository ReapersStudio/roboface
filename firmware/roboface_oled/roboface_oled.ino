/*
 * RoboFace - ESP32 + NFP1315 (SSD1306 128x64 mono OLED) firmware
 * --------------------------------------------------------------
 * Streams its device node from Firebase Realtime Database and renders the
 * EXACT same robot-face geometry + animations as the RoboFace web app.
 *
 * The web app draws on an 800x480 design space and animates by reaction
 * `code` (0..12) plus a `feature` overlay (sweat / vein / curve / bulb / zzz).
 * This firmware reproduces that math 1:1 and scales it to the 128x64 panel.
 * Because everything is parametric and read live from Firebase, ANY new
 * reaction you create in the app shows up here automatically - no reflash.
 *
 * Monochrome panel = white-on-black. Color and glow from the app are lost
 * (cyan/yellow/red all become white); shapes, positions and motion match.
 *
 * Libraries (install via Arduino Library Manager):
 *   - "Firebase Arduino Client Library for ESP8266 and ESP32" by Mobizt
 *   - "Adafruit SSD1306"  (pulls in "Adafruit GFX Library")
 *   - "WiFiManager" by tzapu  (captive-portal WiFi provisioning)
 *
 * Board: any ESP32 dev board.
 *
 * Wiring (NFP1315 / SSD1306 I2C):
 *   OLED VCC -> 3V3
 *   OLED GND -> GND
 *   OLED SCL -> GPIO22   (ESP32 default I2C SCL)
 *   OLED SDA -> GPIO21   (ESP32 default I2C SDA)
 *   I2C address: 0x3C (some modules are 0x3D)
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include <WiFi.h>
#include <WiFiManager.h> // captive-portal WiFi provisioning (no hardcoded creds)
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#include <WiFiClientSecure.h> // OTA over HTTPS (GitHub)
#include <HTTPUpdate.h>       // self-flash from a .bin URL
#include <time.h>             // NTP clock for time/date widgets
#include <ArduinoJson.h>      // parse the playlist the app sends
#include "qrcode.h"           // vendored (ricmoo, MIT) — QR on the OLED for WiFi setup

// ===================== USER CONFIG =====================
// Secrets (WiFi + Firebase) live in arduino_secrets.h, which is git-ignored so
// they are never published. Copy arduino_secrets_example.h -> arduino_secrets.h
// and fill it in. The cloud build (GitHub Actions) generates this file from the
// repository's Actions Secrets, so the source repo stays free of credentials.
//   Provides: API_KEY, DATABASE_URL, DATABASE_SECRET
//   (WiFi is no longer hardcoded — set on the device via the setup portal.)
#include "arduino_secrets.h"

// Must match VITE_FIREBASE_ROOT_PATH in the web app (.env). Default: roboface
#define ROOT_PATH "roboface"
// Must match the device id shown in the app's Devices page. Default below.
#define DEVICE_ID "esp32-face-01"

// Firmware version of THIS build. The device self-updates over the air when
// /roboface/firmware/version in Firebase differs from this. Bump it every
// time you publish a new .bin to your GitHub release.
#define FW_VERSION "2.5.2"

// OLED — two 128x64 panels, EACH ON ITS OWN I2C BUS (no address jumper needed).
//   LEFT  (eyes)      : SDA=D21, SCL=D22  (bus 1)  @ 0x3C
//   RIGHT (dashboard) : SDA=D33, SCL=D32  (bus 2)  @ 0x3C
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C   // both panels keep the default address (separate buses)
#define OLED_ADDR_R 0x3C
#define SDA2 33          // RIGHT panel SDA  -> ESP32 D33
#define SCL2 32          // RIGHT panel SCL  -> ESP32 D32

// Eye size. 1.0 = whole 800x480 design fits (small eyes, lots of margin).
// Higher = zoomed-in / bigger eyes. ~1.7 fills the panel; try 1.5 - 2.2.
#define EYE_ZOOM 1.7f

// Corner rounding in design units (web app uses 25). 0 = sharp corners.
// "Slightly rounded" ~12-18; full app look ~25.
#define EYE_RADIUS 16.0f
// ======================================================

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);    // LEFT  on bus 1 (Wire)
Adafruit_SSD1306 displayR(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire1, -1);  // RIGHT on bus 2 (Wire1)
bool hasRight = false; // set true if the 0x3D panel is detected

// V2 emotion set — declared up top so Arduino's auto-prototypes see the type.
// EMO-style expressive reactions (living.ai EMO vibe). The first 10 are the
// originals; the rest were added so the robot has a full emotional range.
enum Emotion {
  EMO_IDLE, EMO_HAPPY, EMO_SLEEP, EMO_WAKE, EMO_LISTENING,
  EMO_THINKING, EMO_CURIOUS, EMO_EXCITED, EMO_LOVE, EMO_MUSIC,
  EMO_ANGRY, EMO_SAD, EMO_SURPRISED, EMO_WINK, EMO_DIZZY,
  EMO_SKEPTICAL, EMO_LAUGH, EMO_COOL
};

// RIGHT-panel carousel screens (declared here so auto-generated prototypes see it)
enum DashScreen { DASH_TIME, DASH_DATE, DASH_WEATHER, DASH_MUSIC };

FirebaseData stream;
FirebaseData fbdo; // for non-stream reads (OTA version/url)
FirebaseAuth auth;
FirebaseConfig config;
bool firebaseReady = false;

// OTA check timing
unsigned long lastOtaCheck = 0;
const unsigned long OTA_INTERVAL = 5UL * 60UL * 1000UL; // every 5 minutes
bool forceOtaCheck = false;      // set when the app presses "Update now"
bool needPlaylistFetch = true;   // fetch playlist via getString (stream escapes it)
unsigned long lastBeat = 0;      // heartbeat / diagnostics timer
unsigned long lastWeather = 0;   // weather auto-fetch timer
bool needWeather = true;         // fetch weather on boot / city change

// ---- Design space (matches RobotFaceCanvas.jsx) ----
static const float DESIGN_W = 800.0f;
static const float DESIGN_H = 480.0f;
static const float CX = DESIGN_W / 2.0f; // 400
static const float CY = DESIGN_H / 2.0f; // 240

// Precomputed design->screen transform (same fit-and-center as the web app)
float SCALE;
float OFFX, OFFY;

// ---- Live reaction state (updated from Firebase stream) ----
struct ReactionState
{
  int code = 0;
  String feature = "normal";
  String animation = "idle";
  String reaction = "normal";

  float eyeWidth = 130, eyeHeight = 120;
  float leftX = -80, rightX = 80;
  float leftY = 0, rightY = 0;
  float leftAngle = 0, rightAngle = 0;
  bool blink = true;

  // widgets (overlays) + their display order, pushed from the app
  bool wTime = false, wDate = false, wWeather = false, wQuote = false;
  int oTime = 1, oDate = 2, oWeather = 3, oQuote = 4;
  String timeFormat = "24h";
  String region = "auto";
  String weatherLocation = "";
};
ReactionState g;

// quotes shown by the Quote widget (mirror of QUOTES in the web app)
const char *QUOTES[] = {
    "Stay curious.",
    "Beep boop, hello!",
    "Keep building.",
    "One step at a time.",
    "Powered by good vibes.",
};
const int QUOTE_COUNT = sizeof(QUOTES) / sizeof(QUOTES[0]);

// timezone state
String appliedRegion = "";
bool ntpStarted = false;

// ---- Playlist (the ordered slideshow the device cycles on its own) ----
struct Slide
{
  bool widget = false;
  String w = "time"; // widget name when widget==true
  int code = 0;
  String feature = "normal";
  float eyeWidth = 130, eyeHeight = 120;
  float leftX = -80, rightX = 80, leftY = 0, rightY = 0;
  float leftAngle = 0, rightAngle = 0;
  bool blink = true;
};
#define MAX_SLIDES 40
Slide slides[MAX_SLIDES];
int slideCount = 0;
int slideIdx = 0;
unsigned long slideStart = 0;
unsigned long cycleMs = 4000;
int reportedSlide = -1;

// ---- Interpolated pose that is actually drawn (web app lerps at 0.15) ----
struct Pose
{
  float lx, ly, lw, lh, la;
  float rx, ry, rw, rh, ra;
};
Pose cur;
bool curInit = false;

// ---- Blink state machine (mirrors the web app) ----
unsigned long nextBlinkTime = 2000;
bool isBlinking = false;
unsigned long blinkStart = 0;

// ---------------- helpers ----------------
inline float radToDeg(float r) { return r * 180.0f / PI; }
inline float mixf(float a, float b, float t) { return a + (b - a) * t; }
float rr(float a, float b) { return a + (random(0, 10001) / 10000.0f) * (b - a); }

inline int16_t SX(float dx) { return (int16_t)lroundf(OFFX + dx * SCALE); }
inline int16_t SY(float dy) { return (int16_t)lroundf(OFFY + dy * SCALE); }

// Filled, rotated, ROUNDED rectangle (Adafruit_GFX has neither rotation nor
// rotated round-rects). Built from two crossed rects + 4 corner circles, all
// rotated about (cxd,cyd). Rounding amount = EYE_RADIUS (design units).
void fillRotRect(float cxd, float cyd, float wd, float hd, float angDeg)
{
  float a = angDeg * PI / 180.0f;
  float c = cos(a), s = sin(a);
  float hw = wd / 2.0f, hh = hd / 2.0f;

  float r = EYE_RADIUS;
  if (r > hw)
    r = hw;
  if (r > hh)
    r = hh;
  float ihw = hw - r; // inner half-width  (corner-circle centers)
  float ihh = hh - r; // inner half-height

  // fill a rotated rectangle given its half-extents
  auto quad = [&](float ex, float ey)
  {
    const float lx[4] = {-ex, ex, ex, -ex};
    const float ly[4] = {-ey, -ey, ey, ey};
    int16_t xs[4], ys[4];
    for (int i = 0; i < 4; i++)
    {
      float px = cxd + lx[i] * c - ly[i] * s;
      float py = cyd + lx[i] * s + ly[i] * c;
      xs[i] = SX(px);
      ys[i] = SY(py);
    }
    display.fillTriangle(xs[0], ys[0], xs[1], ys[1], xs[2], ys[2], SSD1306_WHITE);
    display.fillTriangle(xs[0], ys[0], xs[2], ys[2], xs[3], ys[3], SSD1306_WHITE);
  };

  quad(hw, ihh); // full width, shorter height
  quad(ihw, hh); // narrower width, full height

  if (r > 0.5f)
  {
    int rpx = (int)ceilf(r * SCALE);
    if (rpx < 1)
      rpx = 1;
    const float cox[4] = {-ihw, ihw, ihw, -ihw};
    const float coy[4] = {-ihh, -ihh, ihh, ihh};
    for (int i = 0; i < 4; i++)
    {
      float px = cxd + cox[i] * c - coy[i] * s;
      float py = cyd + cox[i] * s + coy[i] * c;
      display.fillCircle(SX(px), SY(py), rpx, SSD1306_WHITE);
    }
  }
}

// ---------------- target / motion (1:1 port of applyExactMotion) ----------------
Pose computeTarget(unsigned long t)
{
  float blx = CX + g.leftX;
  float brx = CX + g.rightX;

  Pose p;
  p.lx = blx;
  p.ly = CY + g.leftY;
  p.lw = g.eyeWidth;
  p.lh = g.eyeHeight;
  p.la = g.leftAngle;
  p.rx = brx;
  p.ry = CY + g.rightY;
  p.rw = g.eyeWidth;
  p.rh = g.eyeHeight;
  p.ra = g.rightAngle;

  switch (g.code)
  {
  case 0:
  { // Normal: breathe + saccade
    float breath = sin(t / 600.0f) * 4.0f;
    p.ly = CY + breath;
    p.ry = CY + breath;
    long cyc = t % 10000;
    if (cyc < 1500)
    {
      p.lx = blx + 25;
      p.rx = brx + 25;
    }
    else if (cyc > 4500 && cyc < 6000)
    {
      p.lx = blx - 25;
      p.rx = brx - 25;
    }
    else
    {
      p.lx = blx;
      p.rx = brx;
    }
  }
  break;
  case 3:
  { // Nervous: jitter
    p.lx = blx + rr(-3, 3);
    p.rx = brx + rr(-3, 3);
  }
  break;
  case 6:
  { // Joyful: bounce (curve eyes)
    float b = fabs(sin(t / 150.0f)) * 25.0f;
    p.ly = CY - b + 10;
    p.ry = CY - b + 10;
  }
  break;
  case 8:
  { // Idea: float + tilt (bulb)
    float f = sin(t / 300.0f) * 10.0f;
    p.ly = CY - 30 + f;
    p.ry = CY - 30 + f;
    p.la = radToDeg(sin(t / 200.0f) * 0.1f);
    p.ra = radToDeg(-sin(t / 200.0f) * 0.1f);
  }
  break;
  case 9:
  { // Side eye: pan
    float pan = sin(t / 800.0f) * 10.0f;
    p.lx = blx + pan;
    p.rx = brx + pan;
  }
  break;
  case 11:
  { // Happy walking: bob + tilt
    float bob = sin(t / 150.0f) * 15.0f;
    float ang = -0.1f + sin(t / 200.0f) * 0.15f;
    p.ly = CY - 30 + bob;
    p.ry = CY - 30 + bob;
    p.la = radToDeg(ang);
    p.ra = radToDeg(ang);
  }
  break;
  case 12:
  { // Dancing
    float dt = t / 150.0f;
    float sh = sin(dt) * 40.0f;
    float bnc = fabs(cos(dt)) * 30.0f - 15.0f;
    float h = 100.0f - fabs(cos(dt)) * 30.0f;
    float ang = radToDeg(sin(dt) * 0.3f);
    p.lx = blx + sh;
    p.rx = brx + sh;
    p.ly = CY + bnc;
    p.ry = CY + bnc;
    p.la = ang;
    p.ra = ang;
    p.lh = h;
    p.rh = h;
  }
  break;
  default:
    break; // 1,2,4,5,7,10: static base pose
  }
  return p;
}

// ---------------- feature flags ----------------
bool featCurve() { return g.code == 6 || g.feature == "curve"; }
bool featBulb() { return g.code == 8 || g.feature == "bulb"; }
bool featSweat() { return g.code == 3 || g.feature == "sweat"; }
bool featVein() { return g.code == 5 || g.feature == "vein"; }
bool featZzz() { return g.code == 7 || g.feature == "zzz"; }
bool rectEyesVisible() { return !featCurve() && !featBulb(); }

// ---------------- drawing of feature overlays (approximated for mono) ----------------
void drawCurveEye(float ex, float ey, float angle)
{
  // app: thick arc, radius 60, from PI+PI/4 to 2PI-PI/4 (a smile)
  float cyd = ey + 25.0f;
  float a0 = PI + PI / 4.0f, a1 = 2 * PI - PI / 4.0f;
  float thick = (25.0f * SCALE) / 2.0f; // half line width in px
  int r = (int)ceilf(thick);
  for (float a = a0; a <= a1; a += 0.12f)
  {
    float px = ex + cos(a) * 60.0f;
    float py = cyd + sin(a) * 60.0f;
    display.fillCircle(SX(px), SY(py), r, SSD1306_WHITE);
  }
}

void drawBulb(float ex, float ey, bool on, unsigned long t)
{
  float bodyR = 55.0f;
  display.fillCircle(SX(ex), SY(ey - 20), (int)ceilf(bodyR * SCALE), SSD1306_WHITE);
  // base
  int bw = (int)ceilf(40 * SCALE), bh = (int)ceilf(50 * SCALE);
  display.fillRect(SX(ex) - bw / 2, SY(ey + 45) - bh / 2, bw, bh, SSD1306_WHITE);
  if (on)
  {
    // light rays
    display.drawLine(SX(ex - 70), SY(ey - 70), SX(ex - 50), SY(ey - 50), SSD1306_WHITE);
    display.drawLine(SX(ex), SY(ey - 95), SX(ex), SY(ey - 65), SSD1306_WHITE);
    display.drawLine(SX(ex + 70), SY(ey - 70), SX(ex + 50), SY(ey - 50), SSD1306_WHITE);
  }
}

void drawTeardrop(float xd, float yd, float size)
{
  display.fillCircle(SX(xd), SY(yd + size), (int)ceilf(size * SCALE), SSD1306_WHITE);
  display.fillTriangle(SX(xd - size), SY(yd + size),
                       SX(xd + size), SY(yd + size),
                       SX(xd), SY(yd - size * 1.5f), SSD1306_WHITE);
}

void drawVein(float baseX, float baseY)
{
  float sx = rr(-3, 3), sy = rr(-3, 3);
  auto L = [&](float x1, float y1, float x2, float y2)
  {
    display.drawLine(SX(baseX + x1 + sx), SY(baseY + y1 + sy),
                     SX(baseX + x2 + sx), SY(baseY + y2 + sy), SSD1306_WHITE);
  };
  L(80, -90, 105, -60);
  L(105, -60, 90, -35);
  L(90, -35, 125, -15);
  L(105, -60, 140, -75);
}

void drawZzz(unsigned long t)
{
  float riseA = (t % 2000) / 20.0f;
  float riseB = ((t + 600) % 2000) / 20.0f;
  float zt = t / 500.0f;
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(SX(CX + 80 + 10 + sin(zt) * 10), SY(CY - riseA) - 14);
  display.print("Z");
  display.setTextSize(1);
  display.setCursor(SX(CX + 80 + 30 + sin(zt + 1) * 10), SY(CY - 40 - riseB) - 7);
  display.print("z");
}

// ---------------- time / widgets ----------------
// Timezone is driven by an offset (seconds) the app sends in `tzOffset` minutes,
// so the OLED matches the app exactly (the app knows the real local offset).
long tzOffsetSec = 0;
long appliedOffsetSec = 0x7FFFFFFF; // impossible value -> apply on first call

void applyTimezoneIfChanged()
{
  if (tzOffsetSec == appliedOffsetSec) return;
  configTime(tzOffsetSec, 0, "pool.ntp.org", "time.google.com");
  appliedOffsetSec = tzOffsetSec;
}

void startNtp()
{
  configTime(tzOffsetSec, 0, "pool.ntp.org", "time.google.com");
  appliedOffsetSec = tzOffsetSec;
  ntpStarted = true;
}

bool localNow(struct tm &out)
{
  time_t now = time(nullptr);
  if (now < 100000) return false; // NTP not synced yet
  localtime_r(&now, &out);
  return true;
}

String widgetTimeText(const struct tm &tm)
{
  char buf[16];
  if (g.timeFormat == "12h")
  {
    int h = tm.tm_hour % 12;
    if (h == 0) h = 12;
    snprintf(buf, sizeof(buf), "%d:%02d %s", h, tm.tm_min, tm.tm_hour < 12 ? "AM" : "PM");
  }
  else
  {
    snprintf(buf, sizeof(buf), "%02d:%02d", tm.tm_hour, tm.tm_min);
  }
  return String(buf);
}

String widgetDateText(const struct tm &tm)
{
  static const char *wd[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  static const char *mo[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                             "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  char buf[20];
  snprintf(buf, sizeof(buf), "%s %02d %s", wd[tm.tm_wday], tm.tm_mday, mo[tm.tm_mon]);
  return String(buf);
}

void drawCenteredLine(const String &s, int y)
{
  int16_t x1, y1;
  uint16_t w, h;
  display.setTextSize(1);
  display.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  int x = (SCREEN_WIDTH - (int)w) / 2;
  // black underlay so text stays readable over the eyes
  display.fillRect(x - 2, y - 1, w + 4, 10, SSD1306_BLACK);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(x, y);
  display.print(s);
}

// Render enabled widgets stacked at the top, sorted by their order number.
void drawWidgets(unsigned long t)
{
  struct Item { bool en; int order; String text; };
  Item items[4];
  int n = 0;

  struct tm tm;
  applyTimezoneIfChanged();
  bool haveTime = localNow(tm);

  if (g.wTime) items[n++] = {true, g.oTime, haveTime ? widgetTimeText(tm) : String("--:--")};
  if (g.wDate) items[n++] = {true, g.oDate, haveTime ? widgetDateText(tm) : String("--")};
  if (g.wQuote)
  {
    int qi = (int)((t / 4000) % QUOTE_COUNT); // change every 4s
    items[n++] = {true, g.oQuote, String(QUOTES[qi])};
  }
  if (g.wWeather) items[n++] = {true, g.oWeather, String("Weather --")}; // wired in a later build

  // simple insertion sort by order (n <= 4)
  for (int i = 1; i < n; i++)
  {
    Item key = items[i];
    int j = i - 1;
    while (j >= 0 && items[j].order > key.order) { items[j + 1] = items[j]; j--; }
    items[j + 1] = key;
  }

  int y = 0;
  for (int i = 0; i < n; i++)
  {
    drawCenteredLine(items[i].text, y);
    y += 10;
  }
}

// ---------------- face render (one reaction) ----------------
void renderFace(unsigned long t)
{
  Pose target = computeTarget(t);

  if (!curInit)
  {
    cur = target;
    curInit = true;
  }
  const float k = 0.15f;
  cur.lx = mixf(cur.lx, target.lx, k);
  cur.ly = mixf(cur.ly, target.ly, k);
  cur.lw = mixf(cur.lw, target.lw, k);
  cur.lh = mixf(cur.lh, target.lh, k);
  cur.la = mixf(cur.la, target.la, k);
  cur.rx = mixf(cur.rx, target.rx, k);
  cur.ry = mixf(cur.ry, target.ry, k);
  cur.rw = mixf(cur.rw, target.rw, k);
  cur.rh = mixf(cur.rh, target.rh, k);
  cur.ra = mixf(cur.ra, target.ra, k);

  // blink (only when rect eyes visible, eyes are tall, and blink enabled)
  float blinkFactor = 1.0f;
  bool blinkEnabled = g.blink && rectEyesVisible();
  if (blinkEnabled && t > nextBlinkTime && !isBlinking)
  {
    if (target.lh > 40)
    {
      isBlinking = true;
      blinkStart = t;
    }
    nextBlinkTime = t + (unsigned long)rr(2000, 6000);
  }
  if (isBlinking)
  {
    unsigned long e = t - blinkStart;
    const float dur = 150.0f;
    if (e < dur / 2)
      blinkFactor = 1.0f - (e / (dur / 2)) * 0.95f;
    else if (e < dur)
      blinkFactor = 0.05f + ((e - dur / 2) / (dur / 2)) * 0.95f;
    else
    {
      isBlinking = false;
      blinkFactor = 1.0f;
      if (rr(0, 1) < 0.2f)
        nextBlinkTime = t + 100;
    }
  }

  display.clearDisplay();

  if (rectEyesVisible())
  {
    float lh = max(2.0f, cur.lh * blinkFactor);
    float rh = max(2.0f, cur.rh * blinkFactor);
    fillRotRect(cur.lx, cur.ly, cur.lw, lh, cur.la);
    fillRotRect(cur.rx, cur.ry, cur.rw, rh, cur.ra);
  }
  if (featCurve())
  {
    drawCurveEye(cur.lx, cur.ly, cur.la);
    drawCurveEye(cur.rx, cur.ry, cur.ra);
  }
  if (featBulb())
  {
    bool on = (t / 500) % 2 == 0 ? true : (rr(0, 1) > 0.15f);
    drawBulb(cur.lx, cur.ly, on, t);
    drawBulb(cur.rx, cur.ry, on, t);
  }
  if (featSweat())
  {
    float drip = ((t % 1000) / 1000.0f) * 20.0f;
    drawTeardrop(CX - 80 - 90, CY - 60 + drip, 22);
    drawTeardrop(CX + 80 + 90, CY + 30 + drip, 18);
  }
  if (featVein())
    drawVein(CX + 80, CY);
  if (featZzz())
    drawZzz(t);

  display.display();
}

// ---------------- full-screen widget slides ----------------
void renderWidgetFull(const String &w, unsigned long t)
{
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  applyTimezoneIfChanged();
  struct tm tm;
  bool have = localNow(tm);
  int16_t x1, y1;
  uint16_t tw, th;

  if (w == "time")
  {
    String s = have ? widgetTimeText(tm) : String("--:--");
    if (have && (tm.tm_sec % 2)) s.replace(":", " "); // blinking colon
    display.setTextSize(3);
    display.getTextBounds(s, 0, 0, &x1, &y1, &tw, &th);
    if (tw > SCREEN_WIDTH - 4)
    {
      display.setTextSize(2);
      display.getTextBounds(s, 0, 0, &x1, &y1, &tw, &th);
    }
    display.setCursor((SCREEN_WIDTH - tw) / 2, (SCREEN_HEIGHT - th) / 2);
    display.print(s);
  }
  else if (w == "date")
  {
    static const char *wd[] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
    static const char *mo[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
    if (have)
    {
      char big[4];
      snprintf(big, sizeof(big), "%02d", tm.tm_mday);
      display.setTextSize(3);
      display.getTextBounds(big, 0, 0, &x1, &y1, &tw, &th);
      display.setCursor((SCREEN_WIDTH - tw) / 2, 8);
      display.print(big);
      display.setTextSize(1);
      String line = String(mo[tm.tm_mon]) + "  " + wd[tm.tm_wday];
      display.getTextBounds(line, 0, 0, &x1, &y1, &tw, &th);
      display.setCursor((SCREEN_WIDTH - tw) / 2, 46);
      display.print(line);
    }
    else
    {
      display.setTextSize(2);
      display.setCursor(40, 24);
      display.print("--");
    }
  }
  else if (w == "quote")
  {
    int qi = (int)((t / 4000) % QUOTE_COUNT);
    display.setTextSize(1);
    display.setTextWrap(true);
    display.setCursor(3, 16);
    display.print(QUOTES[qi]);
    display.setTextWrap(false);
  }
  else if (w == "weather")
  {
    // animated sun (rays rotate) + placeholder reading until the API is wired
    int cx = 30, cy = 30, r = 12;
    display.fillCircle(cx, cy, r, SSD1306_WHITE);
    float a = t / 350.0f;
    for (int i = 0; i < 8; i++)
    {
      float ang = a + i * (PI / 4.0f);
      display.drawLine(cx + cos(ang) * (r + 4), cy + sin(ang) * (r + 4),
                       cx + cos(ang) * (r + 9), cy + sin(ang) * (r + 9), SSD1306_WHITE);
    }
    display.setTextSize(1);
    display.setCursor(56, 22);
    display.print("Weather");
    display.setTextSize(2);
    display.setCursor(56, 34);
    display.print("--");
  }
  display.display();
}

// Copy a reaction slide's geometry into the live state used by renderFace().
void applySlide(const Slide &s)
{
  g.code = s.code;
  g.feature = s.feature;
  g.eyeWidth = s.eyeWidth;
  g.eyeHeight = s.eyeHeight;
  g.leftX = s.leftX;
  g.rightX = s.rightX;
  g.leftY = s.leftY;
  g.rightY = s.rightY;
  g.leftAngle = s.leftAngle;
  g.rightAngle = s.rightAngle;
  g.blink = s.blink;
}

void reportCurSlide()
{
  if (slideIdx == reportedSlide) return;
  reportedSlide = slideIdx;
  String p = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID + "/curSlide";
  Firebase.RTDB.setIntAsync(&fbdo, p.c_str(), slideIdx); // async = no render stall
}

// ============================================================================
//  V2 — Dual-display experience.  LEFT = eyes/emotions, RIGHT = dashboard.
//  (Backend untouched: WiFi, Firebase, OTA, sync all unchanged.)
// ============================================================================

#define EYE_CORNER 10 // rounded-rect eye corner radius (Nothing-OS style)

Emotion emotion = EMO_IDLE;
unsigned long emotionStart = 0;
unsigned long emoTransStart = 0;     // start of the eye blink-morph transition
#define EMO_TRANS_MS 320             // LEFT panel: eye blink-morph length
float musicBeat = 0; // 0..1, set from Firebase music data in a later phase

// ---- RIGHT panel carousel: shows ONE thing at a time and slides between them.
// Its transition is INDEPENDENT of the eyes (a vertical slide, not a blink). ----
DashScreen dashScreen = DASH_TIME;
DashScreen dashPrev = DASH_TIME;
unsigned long dashTransStart = 0;
#define DASH_TRANS_MS 460            // RIGHT panel: cross-fade (dissolve) length
#define DASH_DWELL 5000UL            // how long each info screen stays before sliding
// Music takeover: dance + music synced for ~1 min, then time/date, looped while playing.
#define MUSIC_DANCE_MS 60000UL
#define MUSIC_INFO_MS 15000UL
bool musicActive = false;
unsigned long musicModeStart = 0;

// emotion rotation: the device cycles through these (old "playlist" idea)
Emotion emoList[16];
int emoCount = 0;
int emoIdx = -1;

// blink state for the V2 engine
unsigned long nextBlink2 = 3000;
bool blinking2 = false;
unsigned long blinkStart2 = 0;

Emotion emotionFromName(const String &s)
{
  if (s == "happy") return EMO_HAPPY;
  if (s == "sleep") return EMO_SLEEP;
  if (s == "wake") return EMO_WAKE;
  if (s == "listening") return EMO_LISTENING;
  if (s == "thinking") return EMO_THINKING;
  if (s == "curious") return EMO_CURIOUS;
  if (s == "excited") return EMO_EXCITED;
  if (s == "love") return EMO_LOVE;
  if (s == "music") return EMO_MUSIC;
  if (s == "angry") return EMO_ANGRY;
  if (s == "sad") return EMO_SAD;
  if (s == "surprised") return EMO_SURPRISED;
  if (s == "wink") return EMO_WINK;
  if (s == "dizzy") return EMO_DIZZY;
  if (s == "skeptical") return EMO_SKEPTICAL;
  if (s == "laugh") return EMO_LAUGH;
  if (s == "cool") return EMO_COOL;
  return EMO_IDLE;
}

const char *emotionName(Emotion e)
{
  switch (e)
  {
    case EMO_HAPPY: return "happy";
    case EMO_SLEEP: return "sleep";
    case EMO_WAKE: return "wake";
    case EMO_LISTENING: return "listening";
    case EMO_THINKING: return "thinking";
    case EMO_CURIOUS: return "curious";
    case EMO_EXCITED: return "excited";
    case EMO_LOVE: return "love";
    case EMO_MUSIC: return "music";
    case EMO_ANGRY: return "angry";
    case EMO_SAD: return "sad";
    case EMO_SURPRISED: return "surprised";
    case EMO_WINK: return "wink";
    case EMO_DIZZY: return "dizzy";
    case EMO_SKEPTICAL: return "skeptical";
    case EMO_LAUGH: return "laugh";
    case EMO_COOL: return "cool";
    default: return "idle";
  }
}

void setEmotion(const String &name)
{
  Emotion e = emotionFromName(name);
  if (e != emotion) { emotion = e; emotionStart = millis(); emoTransStart = millis(); }
}

// Change the LEFT emotion (triggers the blink-morph) and report it to the app so
// the web preview follows. Used by the rotation and the music/scene coordinator.
void applyEmotion(Emotion e, unsigned long t)
{
  if (e == emotion) return;
  emotion = e;
  emotionStart = t;
  emoTransStart = t;
  if (firebaseReady && Firebase.ready())
  {
    String p = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID + "/emotion";
    Firebase.RTDB.setStringAsync(&fbdo, p.c_str(), emotionName(emotion));
  }
}

// Parse the CSV list of emotions the app sends ("idle,happy,sleep") to rotate.
void parseEmotionList(const String &csv)
{
  emoCount = 0;
  emoIdx = -1;
  int start = 0;
  while (start < (int)csv.length() && emoCount < 16)
  {
    int comma = csv.indexOf(',', start);
    String tok = comma < 0 ? csv.substring(start) : csv.substring(start, comma);
    tok.trim();
    if (tok.length()) emoList[emoCount++] = emotionFromName(tok);
    if (comma < 0) break;
    start = comma + 1;
  }
}

// music beat level 0..1 (placeholder gentle pulse until the music feed is wired)
float beatLevel() { return musicBeat > 0 ? musicBeat : (sinf(millis() / 220.0f) + 1) * 0.5f; }

// ---- ONE unified 256x64 canvas: draw the whole scene, then split to panels ----
#define UI_W 256
#define DASH_X 128 // dashboard occupies the right half (x 128..255)
#define DASH_W 128
GFXcanvas1 ui(UI_W, SCREEN_HEIGHT);

// ---- RIGHT-region data (populated from Firebase; all optional) ----
String wxIcon = "", wxTemp = "", wxLoc = ""; // weather: icon name, "31", "Colombo"
String musTitle = "", musArtist = "";         // now playing
bool musPlaying = false;

// one rounded-rect eye on the unified canvas
static void drawEye(float cx, float cy, float w, float h)
{
  int iw = (int)lroundf(w);
  int ih = (int)lroundf(max(2.0f, h));
  int r = min(min(EYE_CORNER, iw / 2), ih / 2);
  ui.fillRoundRect((int)lroundf(cx - iw / 2.0f), (int)lroundf(cy - ih / 2.0f), iw, ih, r, SSD1306_WHITE);
}

// 0..1 progress through the current change transition (1 = settled, no transition).
static float emoTransK(unsigned long t)
{
  if (emoTransStart == 0) return 1.0f;
  unsigned long el = t - emoTransStart;
  if (el >= EMO_TRANS_MS) return 1.0f;
  return (float)el / (float)EMO_TRANS_MS;
}

// Eye openness envelope for the transition: a quick blink (1 -> ~0 -> 1) so the
// eyes close and reopen as the new emotion, instead of snapping.
static float emoBlinkEnv(unsigned long t)
{
  float k = emoTransK(t);
  if (k >= 1.0f) return 1.0f;
  return 0.06f + 0.94f * fabsf(k * 2.0f - 1.0f);
}

// A slanted eyebrow above an eye. tilt > 0 drops the INNER end (angry); tilt < 0
// raises the inner end (sad/worried). 2px thick so it reads on the panel.
static void drawBrow(float cx, float y, bool leftEye, float tilt, float len)
{
  float half = len / 2.0f;
  int innerX = (int)lroundf(leftEye ? cx + half : cx - half);
  int outerX = (int)lroundf(leftEye ? cx - half : cx + half);
  int innerY = (int)lroundf(y + tilt);
  int outerY = (int)lroundf(y - tilt);
  ui.drawLine(outerX, outerY, innerX, innerY, SSD1306_WHITE);
  ui.drawLine(outerX, outerY + 1, innerX, innerY + 1, SSD1306_WHITE);
}

// A teardrop that wells up under an eye and drips down on a ~1.4s loop.
static void drawTear(float cx, float eyeBottomY, unsigned long t)
{
  float p = (t % 1400) / 1400.0f;
  ui.fillCircle((int)lroundf(cx), (int)lroundf(eyeBottomY + 2 + p * 18.0f), 2, SSD1306_WHITE);
}

// Sunglasses for the "cool" reaction: two outlined lenses + bridge + a glint
// that slides across (the eyes hide behind the shades).
static void drawShades(float lcx, float rcx, float cy, unsigned long t)
{
  const int lw = 30, lh = 22, r = 6;
  for (int i = 0; i < 2; i++)
  {
    int cx = (int)lroundf(i == 0 ? lcx : rcx);
    int x = cx - lw / 2, y = (int)lroundf(cy) - lh / 2;
    ui.fillRoundRect(x, y, lw, lh, r, SSD1306_WHITE);
    ui.fillRoundRect(x + 2, y + 2, lw - 4, lh - 4, r - 1, SSD1306_BLACK);
    int g = (int)((t / 18) % (lw + 16)) - 8; // glint sweep
    ui.drawLine(x + g, y + 3, x + g - 7, y + lh - 3, SSD1306_WHITE);
  }
  int bx = (int)lroundf(lcx) + lw / 2;
  ui.fillRect(bx, (int)lroundf(cy) - 2, (int)lroundf(rcx) - lw / 2 - bx, 3, SSD1306_WHITE);
}

// LEFT region of the canvas — emotion eyes.
void drawEyes(unsigned long t)
{
  const float w = 34, h = 40, gap = 16, cy = 32;
  float lcx = SCREEN_WIDTH / 2.0f - gap / 2 - w / 2;
  float rcx = SCREEN_WIDTH / 2.0f + gap / 2 + w / 2;
  float lw = w, lh = h, rw = w, rh = h, loff = 0, roff = 0, lxo = 0, rxo = 0;
  float lOpen = 1.0f, rOpen = 1.0f; // per-eye height mult (wink / squint)
  int browMode = 0;                 // 0 none, 1 angry, 2 sad, 3 raised, 4 skeptical
  float browTilt = 0;
  bool tear = false, shades = false;
  unsigned long e = t - emotionStart;

  switch (emotion)
  {
    case EMO_IDLE:      loff = roff = sinf(t / 700.0f) * 2.0f; break;
    case EMO_HAPPY:     loff = roff = -fabsf(sinf(t / 180.0f)) * 6.0f; lh = rh = h * 0.8f; break;
    case EMO_SLEEP:     lh = rh = 4; loff = roff = h / 2 - 2; break;
    case EMO_WAKE: { float k = constrain(e / 600.0f, 0.0f, 1.0f); lh = rh = 4 + (h - 4) * k; } break;
    case EMO_LISTENING: lw = rw = w * 1.12f; lh = rh = h * 1.12f; break;
    case EMO_THINKING:  lxo = 8; rxo = -8; loff = roff = -6; break;
    case EMO_CURIOUS:   lh = h * 1.2f; lw = w * 1.1f; rh = h * 0.85f; rw = w * 0.9f; break;
    case EMO_EXCITED:   loff = roff = -fabsf(sinf(t / 90.0f)) * 8.0f; break;
    case EMO_LOVE: { float p = (sinf(t / 350.0f) + 1) * 0.5f; lw = rw = w * (0.9f + 0.2f * p); lh = rh = h * (0.9f + 0.2f * p); } break;
    case EMO_MUSIC: { float b = beatLevel(); lh = rh = h * (0.85f + 0.4f * b); lw = rw = w * (0.9f + 0.15f * b); } break;
    // ---- EMO-style additions ----
    case EMO_ANGRY: { lh = rh = h * 0.6f; loff = roff = 4; float j = sinf(t / 55.0f) * 1.0f; lxo = j; rxo = -j; browMode = 1; browTilt = 7; } break;
    case EMO_SAD: { lh = rh = h * 0.7f; lw = rw = w * 0.95f; loff = roff = 7 + sinf(t / 900.0f) * 2.0f; browMode = 2; browTilt = 6; tear = ((t / 2200) % 2) == 0; } break;
    case EMO_SURPRISED: { lw = rw = w * 1.28f; lh = rh = h * 1.3f; loff = roff = -3; browMode = 3; } break;
    case EMO_WINK: { float ph = fmodf((float)t, 1600.0f); lOpen = (ph < 300.0f) ? 0.08f : 1.0f; loff = roff = -fabsf(sinf(t / 200.0f)) * 3.0f; } break;
    case EMO_DIZZY: { float a = t / 260.0f; lxo = cosf(a) * 5.0f; loff = sinf(a) * 4.0f; rxo = cosf(a + PI) * 5.0f; roff = sinf(a + PI) * 4.0f; lw = rw = w * 0.9f; lh = rh = h * 0.9f; } break;
    case EMO_SKEPTICAL: { lOpen = 0.45f; loff = -3; lxo = rxo = 5; browMode = 4; browTilt = 5; } break;
    case EMO_LAUGH: { loff = roff = -fabsf(sinf(t / 110.0f)) * 9.0f; lh = rh = h * 0.5f; float sh = sinf(t / 70.0f) * 2.0f; lxo = sh; rxo = sh; } break;
    case EMO_COOL: shades = true; break;
  }

  float bf = 1.0f;
  bool canBlink = (emotion != EMO_SLEEP && emotion != EMO_WAKE && emotion != EMO_WINK && emotion != EMO_COOL);
  if (canBlink && t > nextBlink2 && !blinking2) { blinking2 = true; blinkStart2 = t; nextBlink2 = t + (unsigned long)rr(2500, 6000); }
  if (blinking2)
  {
    unsigned long be = t - blinkStart2; const float d = 140;
    if (be < d / 2) bf = 1.0f - (be / (d / 2)) * 0.92f;
    else if (be < d) bf = 0.08f + ((be - d / 2) / (d / 2)) * 0.92f;
    else blinking2 = false;
  }

  float env = emoBlinkEnv(t); // blink-morph into the new emotion

  if (shades) { drawShades(lcx, rcx, cy, t); return; }

  drawEye(lcx + lxo, cy + loff, lw, lh * bf * env * lOpen);
  drawEye(rcx + rxo, cy + roff, rw, rh * bf * env * rOpen);

  // overlays (brows / tears) — based on the steady eye box, not the blink
  if (browMode)
  {
    float byL = cy + loff - lh / 2.0f - (browMode == 3 ? 8.0f : 5.0f);
    float byR = cy + roff - rh / 2.0f - (browMode == 3 ? 8.0f : 5.0f);
    if (browMode == 1) { drawBrow(lcx + lxo, byL, true, browTilt, lw); drawBrow(rcx + rxo, byR, false, browTilt, rw); }
    else if (browMode == 2) { drawBrow(lcx + lxo, byL, true, -browTilt, lw); drawBrow(rcx + rxo, byR, false, -browTilt, rw); }
    else if (browMode == 3) { drawBrow(lcx + lxo, byL, true, 0, lw); drawBrow(rcx + rxo, byR, false, 0, rw); }
    else if (browMode == 4) { drawBrow(lcx + lxo, byL - 3, true, -browTilt, lw); drawBrow(rcx + rxo, byR, false, 0, rw); }
  }
  if (tear) drawTear(lcx + lxo, cy + loff + lh / 2.0f, t);
}

// small weather glyph (~18x16) at absolute (x,y) on the canvas
void drawWxIcon(int x, int y, const String &w)
{
  int cx = x + 8, cy = y + 8;
  if (w == "sunny" || w == "sun" || w == "clear")
  {
    ui.fillCircle(cx, cy, 4, SSD1306_WHITE);
    for (int i = 0; i < 8; i++)
    {
      float a = i * (PI / 4);
      ui.drawLine(cx + cos(a) * 6, cy + sin(a) * 6, cx + cos(a) * 8, cy + sin(a) * 8, SSD1306_WHITE);
    }
  }
  else if (w == "night" || w == "moon")
  {
    ui.fillCircle(cx, cy, 6, SSD1306_WHITE);
    ui.fillCircle(cx + 3, cy - 2, 6, SSD1306_BLACK); // crescent
  }
  else // cloud / rain / storm / cloudy
  {
    ui.fillRoundRect(x + 1, y + 6, 16, 6, 3, SSD1306_WHITE);
    ui.fillCircle(x + 6, y + 6, 4, SSD1306_WHITE);
    ui.fillCircle(x + 11, y + 5, 5, SSD1306_WHITE);
    if (w == "rain")
      for (int i = 0; i < 3; i++) ui.drawLine(x + 4 + i * 5, y + 13, x + 4 + i * 5, y + 16, SSD1306_WHITE);
    if (w == "storm")
    { ui.drawLine(x + 9, y + 12, x + 6, y + 16, SSD1306_WHITE); ui.drawLine(x + 6, y + 16, x + 10, y + 14, SSD1306_WHITE); }
  }
}

// scrolling text within the right region, shifted by xoff for the slide
// (clipped to its own [lo, lo+DASH_W) window; the left-region wipe in drawFrame
// keeps any overshoot off the eyes panel).
void drawMarquee(const String &s, int y, unsigned long t, int xoff)
{
  int lo = DASH_X + xoff;
  int textW = s.length() * 6;
  if (textW <= DASH_W)
  {
    ui.setTextSize(1);
    ui.setCursor(lo + (DASH_W - textW) / 2, y);
    ui.print(s);
    return;
  }
  String seg = s + "    ";
  int total = seg.length() * 6;
  int off = (int)((t / 50) % total);
  String two = seg + seg;
  for (int i = 0; i < (int)two.length(); i++)
  {
    int x = lo - off + i * 6;
    if (x >= lo + DASH_W) break;
    if (x >= lo) ui.drawChar(x, y, two[i], SSD1306_WHITE, SSD1306_BLACK, 1);
  }
}

// 0..1 progress through the RIGHT-panel slide (1 = settled).
static float dashTransK(unsigned long t)
{
  if (dashTransStart == 0) return 1.0f;
  unsigned long el = t - dashTransStart;
  if (el >= DASH_TRANS_MS) return 1.0f;
  return (float)el / (float)DASH_TRANS_MS;
}

// Centered text in the dash region at a given size and y, shifted by xoff.
static void dashCenter(const String &s, uint8_t size, int y, int xoff)
{
  ui.setTextSize(size);
  int16_t x1, y1; uint16_t tw, th;
  ui.getTextBounds(s, 0, 0, &x1, &y1, &tw, &th);
  ui.setCursor(DASH_X + xoff + (DASH_W - (int)tw) / 2, y);
  ui.print(s);
}

// Draw ONE carousel screen, shifted horizontally by xoff (for the slide).
void drawDashScreen(DashScreen s, int xoff, unsigned long t)
{
  struct tm tm;
  bool have = localNow(tm);
  ui.setTextColor(SSD1306_WHITE);

  static const char *WD[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
  static const char *MO[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                             "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};

  switch (s)
  {
    case DASH_TIME:
    {
      if (!have) { dashCenter("--:--", 2, 28, xoff); break; }
      char core[8]; const char *ap = "";
      if (g.timeFormat == "12h")
      {
        int h = tm.tm_hour % 12; if (h == 0) h = 12;
        snprintf(core, sizeof(core), "%d:%02d", h, tm.tm_min);
        ap = tm.tm_hour < 12 ? "AM" : "PM";
      }
      else snprintf(core, sizeof(core), "%02d:%02d", tm.tm_hour, tm.tm_min);
      dashCenter(core, 3, 18, xoff);             // big clock
      if (ap[0]) dashCenter(ap, 1, 46, xoff);    // small AM/PM
      break;
    }
    case DASH_DATE:
    {
      if (!have) { dashCenter("--", 2, 24, xoff); break; }
      dashCenter(WD[tm.tm_wday], 2, 8, xoff);
      char dm[12]; snprintf(dm, sizeof(dm), "%s %d", MO[tm.tm_mon], tm.tm_mday);
      dashCenter(dm, 2, 32, xoff);
      char yr[6]; snprintf(yr, sizeof(yr), "%d", tm.tm_year + 1900);
      dashCenter(yr, 1, 54, xoff);
      break;
    }
    case DASH_WEATHER:
    {
      if (wxIcon.length()) drawWxIcon(DASH_X + xoff + DASH_W / 2 - 8, 4, wxIcon);
      dashCenter(wxTemp.length() ? wxTemp + "C" : String("--"), 3, 26, xoff);
      if (wxLoc.length()) dashCenter(wxLoc, 1, 54, xoff);
      break;
    }
    case DASH_MUSIC:
    {
      drawMarquee(musTitle.length() ? musTitle : String("Now Playing"), 2, t, xoff);
      // beat-reactive EQ bars (same beatLevel() that drives the dancing eyes)
      float b = beatLevel();
      const int bars = 7, bw = 10, gp = 4;
      int totw = bars * bw + (bars - 1) * gp;
      int bx = DASH_X + xoff + (DASH_W - totw) / 2, baseY = 46;
      for (int i = 0; i < bars; i++)
      {
        float lvl = b * (0.5f + 0.5f * sinf(t / 120.0f + i * 0.9f));
        int hgt = (int)(4 + lvl * 22);
        ui.fillRect(bx + i * (bw + gp), baseY - hgt, bw, hgt, SSD1306_WHITE);
      }
      if (musArtist.length()) drawMarquee(musArtist, 54, t, xoff);
      break;
    }
  }
}

// Ordered-dither fade for the dash region: removes a stipple of pixels so the
// content appears to fade. density 0 = fully gone, 16 = fully visible. This is
// how you "fade" on a 1-bit panel (no real opacity).
static void ditherFadeDash(int density)
{
  static const uint8_t bayer[4][4] = {
    { 0,  8,  2, 10},
    {12,  4, 14,  6},
    { 3, 11,  1,  9},
    {15,  7, 13,  5},
  };
  if (density >= 16) return; // fully visible
  for (int y = 0; y < SCREEN_HEIGHT; y++)
    for (int x = DASH_X; x < UI_W; x++)
      if (bayer[y & 3][x & 3] >= density)
        ui.drawPixel(x, y, SSD1306_BLACK);
}

// RIGHT region — a single-card carousel that FADES between screens (no motion):
// the current screen dithers out, then the next dithers in.
void drawDashboard(unsigned long t)
{
  applyTimezoneIfChanged();
  float p = dashTransK(t);
  if (p < 1.0f)
  {
    if (p < 0.5f) // first half: old screen fades out
    {
      drawDashScreen(dashPrev, 0, t);
      ditherFadeDash((int)lroundf((1.0f - p * 2.0f) * 16.0f));
    }
    else          // second half: new screen fades in
    {
      drawDashScreen(dashScreen, 0, t);
      ditherFadeDash((int)lroundf((p - 0.5f) * 2.0f * 16.0f));
    }
  }
  else
  {
    drawDashScreen(dashScreen, 0, t);
  }
}

// Split the one 256x64 canvas onto the two physical panels.
void blitToPanels()
{
  display.clearDisplay();
  display.drawBitmap(0, 0, ui.getBuffer(), UI_W, SCREEN_HEIGHT, SSD1306_WHITE); // left half (rest clipped)
  display.display();
  if (hasRight)
  {
    displayR.clearDisplay();
    displayR.drawBitmap(-DASH_X, 0, ui.getBuffer(), UI_W, SCREEN_HEIGHT, SSD1306_WHITE); // right half
    displayR.display();
  }
}

// Cycle the LEFT emotion rotation (if the app set one). Wall-clock based so it's
// steady; reports the current emotion back so the app preview follows.
void stepEmotionRotation(unsigned long t)
{
  if (emoCount == 0) return;
  int idx = 0;
  if (emoCount > 1)
  {
    time_t ep = time(nullptr);
    unsigned long cs = cycleMs / 1000;
    if (cs < 1) cs = 1;
    idx = (ep > 100000) ? (int)((ep / cs) % emoCount)
                        : (int)((t / (cycleMs ? cycleMs : 4000)) % emoCount);
  }
  if (idx != emoIdx)
  {
    emoIdx = idx;
    applyEmotion(emoList[idx], t);
  }
}

// Switch the RIGHT carousel to a new screen (starts its vertical slide).
void setDashScreen(DashScreen s, unsigned long t)
{
  if (s == dashScreen) return;
  dashPrev = dashScreen;
  dashScreen = s;
  dashTransStart = t;
}

// Scene coordinator: drives BOTH panels each frame.
//  - No music: RIGHT cycles TIME -> DATE -> WEATHER; LEFT runs the emotion rotation.
//  - Music playing: ~1 min of dancing(LEFT) + music screen(RIGHT) synced, then a
//    short TIME/DATE stretch, looped while music keeps playing.
// ---- EMO-style personality + reactions -------------------------------------
// reaction override: a momentary expression (from a touch/sound/face event or
// the app) that takes priority over the autonomous mood for a short time.
unsigned long reactionUntil = 0;
void triggerReaction(Emotion e, unsigned long ms, unsigned long t)
{
  applyEmotion(e, t);
  reactionUntil = t + ms;
}

// Autonomous "alive" behaviour — the robot expresses moods on its own (like EMO)
// when nothing else is driving it (no music, no app rotation list).
unsigned long nextMood = 0;
int awakeStreak = 0;
unsigned long lastHourReact = 0;
static Emotion pickFrom(const Emotion *a, int n) { return a[random(0, n)]; }
// Context-aware autonomous reactions — picks moods based on time of day, weather
// and the clock so it feels like it's "thinking", not just random (EMO-like AI feel).
void stepPersonality(unsigned long t)
{
  if (t < nextMood) return;
  struct tm tm; bool haveT = localNow(tm);
  int hour = haveT ? tm.tm_hour : 12;
  bool night   = (hour >= 22 || hour < 6);
  bool morning = (hour >= 6 && hour < 11);
  bool rainy   = (wxIcon == "rain" || wxIcon == "storm");
  bool sunny   = (wxIcon == "sunny" || wxIcon == "clear" || wxIcon == "sun");

  // wake / stay-asleep (sleeps more at night)
  if (emotion == EMO_SLEEP) {
    if (night && random(0, 100) < 70) { nextMood = t + (unsigned long)rr(6000, 12000); return; }
    applyEmotion(EMO_WAKE, t); nextMood = t + 1000; awakeStreak = 0; return;
  }
  awakeStreak++;
  int sleepAfter = night ? 6 : 16, sleepChance = night ? 70 : 22;
  if (awakeStreak > sleepAfter && random(0, 100) < sleepChance) {
    applyEmotion(EMO_SLEEP, t); nextMood = t + (unsigned long)rr(5000, 12000); return;
  }

  // on-the-hour: a little surprise (once per hour)
  if (haveT && tm.tm_min == 0 && (t - lastHourReact > 120000UL)) {
    lastHourReact = t; applyEmotion(EMO_SURPRISED, t); nextMood = t + 1500; return;
  }

  // context-biased mood pools
  static const Emotion morn[] = { EMO_HAPPY, EMO_EXCITED, EMO_HAPPY, EMO_LOVE, EMO_CURIOUS, EMO_WINK };
  static const Emotion rain[] = { EMO_SAD, EMO_IDLE, EMO_THINKING, EMO_IDLE, EMO_SKEPTICAL };
  static const Emotion sun[]  = { EMO_HAPPY, EMO_EXCITED, EMO_COOL, EMO_LAUGH, EMO_CURIOUS, EMO_LOVE };
  static const Emotion day[]  = { EMO_IDLE, EMO_HAPPY, EMO_CURIOUS, EMO_THINKING, EMO_WINK, EMO_SURPRISED, EMO_COOL, EMO_LAUGH };
  Emotion next;
  if (morning)    next = pickFrom(morn, 6);
  else if (rainy) next = pickFrom(rain, 5);
  else if (sunny) next = pickFrom(sun, 6);
  else            next = pickFrom(day, 8);

  applyEmotion(next, t);
  nextMood = t + (unsigned long)rr(2600, 6000);
}

void stepScene(unsigned long t)
{
  bool music = musPlaying && musTitle.length();
  if (music && !musicActive) { musicActive = true; musicModeStart = t; }
  if (!music) musicActive = false;

  // a sensor/app reaction overrides everything briefly
  bool reacting = (t < reactionUntil);

  if (music && !reacting)
  {
    unsigned long period = MUSIC_DANCE_MS + MUSIC_INFO_MS;
    unsigned long ph = (t - musicModeStart) % period;
    if (ph < MUSIC_DANCE_MS)
    {
      setDashScreen(DASH_MUSIC, t); // RIGHT: now-playing + beat bars
      emoIdx = -1;                  // so rotation re-applies cleanly afterwards
      applyEmotion(EMO_MUSIC, t);   // LEFT: dancing, synced to the same beat
    }
    else
    {
      unsigned long ip = ph - MUSIC_DANCE_MS;
      setDashScreen(ip < MUSIC_INFO_MS / 2 ? DASH_TIME : DASH_DATE, t);
      stepEmotionRotation(t);
    }
  }
  else
  {
    static const DashScreen seq[] = {DASH_TIME, DASH_DATE, DASH_WEATHER};
    setDashScreen(seq[(t / DASH_DWELL) % 3], t);
    if (reacting) { /* hold the reaction emotion */ }
    else if (emoCount > 0) stepEmotionRotation(t); // app-chosen rotation wins
    else stepPersonality(t);                        // otherwise act alive on its own
  }
}

// Top-level frame: render the whole scene once, then split to both panels.
void drawFrame()
{
  static unsigned long lastFrame = 0;
  if (millis() - lastFrame < 33) return; // ~30fps (I2C bandwidth limit for 2 panels)
  lastFrame = millis();
  unsigned long t = millis();
  stepScene(t); // drives both panels (rotation + music sync)
  ui.fillScreen(0);
  drawDashboard(t); // right region (may overshoot left during the slide)
  ui.fillRect(0, 0, DASH_X, SCREEN_HEIGHT, SSD1306_BLACK); // keep slide off the eyes
  drawEyes(t);      // left region
  blitToPanels();
}

// Parse the playlist JSON the app sends into our local slides[] array.
// The value is stored as a STRING in RTDB, so it comes back escaped
// (outer quotes + \" for inner quotes) — clean it up before parsing.
void parsePlaylist(const String &jsonIn)
{
  String json = jsonIn;
  json.trim();
  if (json.length() >= 2 && json.startsWith("\"") && json.endsWith("\""))
    json = json.substring(1, json.length() - 1); // strip outer quotes
  json.replace("\\\"", "\""); // unescape inner quotes
  json.replace("\\\\", "\\");

  if (json.length() < 2) { slideCount = 0; return; }
  DynamicJsonDocument doc(8192);
  DeserializationError err = deserializeJson(doc, json);
  if (err)
  {
    Serial.printf("playlist parse error: %s | raw: %s\n", err.c_str(), json.c_str());
    return;
  }
  JsonArray arr = doc.as<JsonArray>();
  int n = 0;
  for (JsonObject o : arr)
  {
    if (n >= MAX_SLIDES) break;
    Slide &s = slides[n];
    const char *type = o["t"] | "r";
    if (type[0] == 'w')
    {
      s.widget = true;
      s.w = String((const char *)(o["wid"] | "time"));
    }
    else
    {
      s.widget = false;
      s.code = o["code"] | 0;
      s.feature = String((const char *)(o["feat"] | "normal"));
      s.eyeWidth = o["ew"] | 130.0f;
      s.eyeHeight = o["eh"] | 120.0f;
      s.leftX = o["lx"] | -80.0f;
      s.rightX = o["rx"] | 80.0f;
      s.leftY = o["ly"] | 0.0f;
      s.rightY = o["ry"] | 0.0f;
      s.leftAngle = o["la"] | 0.0f;
      s.rightAngle = o["ra"] | 0.0f;
      s.blink = ((int)(o["bl"] | 1)) != 0;
    }
    n++;
  }
  slideCount = n;
  if (slideIdx >= slideCount) slideIdx = 0;
  slideStart = millis();
  reportedSlide = -1;
  Serial.printf("playlist: %d slides\n", slideCount);
}

// ---------------- Firebase stream handling ----------------
void applyField(const String &k, const String &v)
{
  if (k == "playlistJson")
    parsePlaylist(v);
  else if (k == "cycleMs")
  {
    unsigned long ms = (unsigned long)v.toInt();
    if (ms >= 500) cycleMs = ms;
  }
  else if (k == "jumpTo")
  {
    int j = v.toInt();
    if (j >= 0 && j < slideCount)
    {
      slideIdx = j;
      slideStart = millis();
      reportCurSlide();
    }
  }
  else if (k == "code")
    g.code = v.toInt();
  else if (k == "feature")
    g.feature = v;
  else if (k == "animation")
    g.animation = v;
  else if (k == "reaction")
    g.reaction = v;

  else if (k == "eyeWidth")
    g.eyeWidth = v.toFloat();
  else if (k == "eyeHeight")
    g.eyeHeight = v.toFloat();
  else if (k == "leftX")
    g.leftX = v.toFloat();
  else if (k == "rightX")
    g.rightX = v.toFloat();
  else if (k == "leftY")
    g.leftY = v.toFloat();
  else if (k == "rightY")
    g.rightY = v.toFloat();
  else if (k == "leftAngle")
    g.leftAngle = v.toFloat();
  else if (k == "rightAngle")
    g.rightAngle = v.toFloat();
  else if (k == "blink")
    g.blink = (v == "true" || v == "1");
  else if (k == "fwUpdateNow")
  {
    if (v == "true" || v == "1") forceOtaCheck = true; // app pressed "Update now"
  }
  else if (k == "widgetTime")
    g.wTime = (v == "true" || v == "1");
  else if (k == "widgetDate")
    g.wDate = (v == "true" || v == "1");
  else if (k == "widgetWeather")
    g.wWeather = (v == "true" || v == "1");
  else if (k == "widgetQuote")
    g.wQuote = (v == "true" || v == "1");
  else if (k == "widgetTimeOrder")
    g.oTime = v.toInt();
  else if (k == "widgetDateOrder")
    g.oDate = v.toInt();
  else if (k == "widgetWeatherOrder")
    g.oWeather = v.toInt();
  else if (k == "widgetQuoteOrder")
    g.oQuote = v.toInt();
  else if (k == "timeFormat")
    g.timeFormat = v;
  else if (k == "region")
    g.region = v;
  else if (k == "tzOffset")
    tzOffsetSec = (long)v.toInt() * 60L; // minutes -> seconds
  else if (k == "emotion")
    setEmotion(v); // V2: left panel emotion (idle/happy/sleep/listening/...)
  else if (k == "reactNow")
    triggerReaction(emotionFromName(v), 4000, millis()); // momentary EMO reaction (app/sensor)
  else if (k == "emotionList")
    parseEmotionList(v); // V2: rotation list the device cycles through
  else if (k == "wxIcon")
    wxIcon = v;
  else if (k == "wxTemp")
    wxTemp = v;
  else if (k == "wxLoc")
  {
    if (v != wxLoc) { wxLoc = v; needWeather = true; } // re-fetch when city changes
  }
  else if (k == "musTitle")
    musTitle = v;
  else if (k == "musArtist")
    musArtist = v;
  else if (k == "musPlaying")
    musPlaying = (v == "true" || v == "1");
  else if (k == "weatherLocation")
    g.weatherLocation = v;
}

void streamCallback(FirebaseStream data)
{
  String path = data.dataPath();
  if (path == "/")
  {
    // whole node arrived as JSON. The iterator escapes nested-JSON strings, so
    // we don't trust playlistJson here — we re-fetch it cleanly with getString.
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    String key, val;
    int type = 0;
    for (size_t i = 0; i < len; i++)
    {
      json->iteratorGet(i, type, key, val);
      if (key == "playlistJson")
      {
        needPlaylistFetch = true;
        continue;
      }
      // the iterator returns string values wrapped in quotes — strip them
      if (val.length() >= 2 && val.startsWith("\"") && val.endsWith("\""))
        val = val.substring(1, val.length() - 1);
      applyField(key, val);
    }
    json->iteratorEnd();
  }
  else
  {
    String key = path.substring(1);
    if (key == "playlistJson")
      needPlaylistFetch = true;
    else
      applyField(key, data.to<String>());
  }
}

void streamTimeoutCallback(bool timeout)
{
  if (timeout)
    Serial.println("[stream] timeout, resuming...");
  if (!stream.httpConnected())
    Serial.printf("[stream] error: %s\n", stream.errorReason().c_str());
}

// ---------------- OTA (self-update from GitHub release .bin) ----------------
void otaMessage(const char *l1, const char *l2)
{
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(l1);
  if (l2)
  {
    display.setCursor(0, 16);
    display.println(l2);
  }
  display.display();
}

// Report this device's firmware state to Firebase so the app can show it.
void reportFw(const char *status, int progress)
{
  String base = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID;
  Firebase.RTDB.setString(&fbdo, (base + "/fwVersion").c_str(), FW_VERSION);
  Firebase.RTDB.setString(&fbdo, (base + "/fwStatus").c_str(), status);
  Firebase.RTDB.setInt(&fbdo, (base + "/fwProgress").c_str(), progress);
}

// Consumer-style "installing" screen with a progress bar (TV / smartwatch feel).
void otaProgressBar(const char *title, const char *sub, int pct)
{
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 4);
  display.println(title);
  if (sub && sub[0])
  {
    display.setCursor(0, 16);
    display.println(sub);
  }
  const int x = 6, y = 36, w = SCREEN_WIDTH - 12, h = 12;
  display.drawRoundRect(x, y, w, h, 3, SSD1306_WHITE);
  int fill = (w - 4) * pct / 100;
  if (fill > 0) display.fillRoundRect(x + 2, y + 2, fill, h - 4, 1, SSD1306_WHITE);
  display.setCursor(x, y + h + 5);
  display.print(pct);
  display.println("%");
  display.display();
}

// Checks /roboface/firmware/{version,url}; if newer than FW_VERSION, downloads
// over HTTPS with a live progress bar, flashes, and reboots. Reports status to
// the app throughout (checking / up-to-date / updating / failed).
void checkForOTA()
{
  reportFw("checking", 0);
  String base = String("/") + ROOT_PATH + "/firmware";

  if (!Firebase.RTDB.getString(&fbdo, (base + "/version").c_str()))
  {
    reportFw("idle", 0);
    return;
  }
  String remoteVer = fbdo.stringData();
  remoteVer.replace("\"", "");
  remoteVer.trim();
  if (remoteVer.length() == 0 || remoteVer == FW_VERSION)
  {
    reportFw("up-to-date", 0); // app shows "Up to date"
    return;
  }

  if (!Firebase.RTDB.getString(&fbdo, (base + "/url").c_str()))
  {
    reportFw("up-to-date", 0);
    return;
  }
  String url = fbdo.stringData();
  url.replace("\"", "");
  url.trim();
  if (!url.startsWith("http"))
  {
    reportFw("up-to-date", 0);
    return;
  }

  Serial.printf("OTA: %s -> %s\n  %s\n", FW_VERSION, remoteVer.c_str(), url.c_str());
  reportFw("updating", 0);
  otaProgressBar("Update available", remoteVer.c_str(), 0);
  delay(1200); // let the user see the "update available" notice

  WiFiClientSecure client;
  client.setInsecure(); // skip cert validation (GitHub HTTPS)
  httpUpdate.rebootOnUpdate(true);
  httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); // GitHub 302s to a CDN

  // Live progress bar on the OLED (throttled to whole-percent changes).
  httpUpdate.onProgress([](int cur, int total) {
    static int lastPct = -1;
    int pct = (total > 0) ? (int)((cur * 100L) / total) : 0;
    if (pct != lastPct)
    {
      lastPct = pct;
      otaProgressBar("Installing update", nullptr, pct);
    }
  });

  t_httpUpdate_return ret = httpUpdate.update(client, url);
  if (ret == HTTP_UPDATE_FAILED)
  {
    Serial.printf("OTA failed (%d): %s\n",
                  httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
    reportFw("failed", 0);
    otaProgressBar("Update failed", "will retry", 0);
    delay(2000);
  }
  // HTTP_UPDATE_OK reboots automatically; on next boot it reports the new version.
}

// ---------------- setup / loop ----------------
#define SETUP_AP_NAME "Kiibo" // the setup hotspot name (also on the box QR)

// Setup screen: a big, centered WiFi QR on a white card (dark modules on a lit
// background, with a wide quiet zone) so a phone camera locks on and shows the
// "Join Wi-Fi 'Kiibo'?" popup. Scanning it joins the device's setup hotspot.
void drawWifiSetupScreen()
{
  display.clearDisplay();

  QRCode qrcode;
  uint8_t qrData[qrcode_getBufferSize(2)];
  qrcode_initText(&qrcode, qrData, 2, ECC_LOW, "WIFI:S:" SETUP_AP_NAME ";T:nopass;;");

  const int scale = 2;
  int qpx = qrcode.size * scale;        // 25 * 2 = 50px
  int quiet = 6;                        // white border helps the camera lock on
  int cardH = qpx + quiet * 2;          // 62 -> fills the 64px height
  int cx = SCREEN_WIDTH - qpx - quiet - 2; // QR on the right
  int cy = (SCREEN_HEIGHT - cardH) / 2 + quiet;

  display.fillRect(cx - quiet, 1, qpx + quiet * 2, cardH, SSD1306_WHITE);
  for (uint8_t y = 0; y < qrcode.size; y++)
    for (uint8_t x = 0; x < qrcode.size; x++)
      if (qrcode_getModule(&qrcode, x, y))
        display.fillRect(cx + x * scale, cy + y * scale, scale, scale, SSD1306_BLACK);

  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 8);  display.println("Scan");
  display.setCursor(0, 18); display.println("with");
  display.setCursor(0, 28); display.println("phone");
  display.setCursor(0, 44); display.println("WiFi:");
  display.setCursor(0, 54); display.println(SETUP_AP_NAME);
  display.display();
}

// ---------------- Weather: auto-fetch from Open-Meteo (free, no API key) ------
String iconForCode(int c, int isDay)
{
  if (c == 0) return isDay ? "sunny" : "night";
  if (c <= 3) return "cloudy";
  if (c >= 95) return "storm";
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  return "cloudy";
}

// Geocode the city -> lat/lon, then read current temperature + condition.
// Sets wxTemp/wxIcon locally AND writes them to Firebase so the app shows them.
void fetchWeather()
{
  if (wxLoc.length() == 0) return;
  WiFiClientSecure c;
  c.setInsecure();
  HTTPClient http;
  http.setTimeout(6000);

  String loc = wxLoc; loc.replace(" ", "%20");
  String gurl = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + loc;
  float lat = 1000, lon = 1000;
  if (http.begin(c, gurl) && http.GET() == 200)
  {
    DynamicJsonDocument doc(4096);
    if (!deserializeJson(doc, http.getString()))
    {
      lat = doc["results"][0]["latitude"] | 1000.0;
      lon = doc["results"][0]["longitude"] | 1000.0;
    }
  }
  http.end();
  if (lat > 900) { Serial.println("weather: geocode failed"); return; }

  String furl = "https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code,is_day&latitude=" +
                String(lat, 4) + "&longitude=" + String(lon, 4);
  if (http.begin(c, furl) && http.GET() == 200)
  {
    DynamicJsonDocument fd(2048);
    if (!deserializeJson(fd, http.getString()))
    {
      float temp = fd["current"]["temperature_2m"] | -999.0;
      int code = fd["current"]["weather_code"] | -1;
      int isDay = fd["current"]["is_day"] | 1;
      if (temp > -900)
      {
        wxTemp = String((int)lroundf(temp));
        wxIcon = iconForCode(code, isDay);
        Serial.printf("weather: %sC %s\n", wxTemp.c_str(), wxIcon.c_str());
        String base = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID;
        Firebase.RTDB.setStringAsync(&fbdo, (base + "/wxTemp").c_str(), wxTemp);
        Firebase.RTDB.setStringAsync(&fbdo, (base + "/wxIcon").c_str(), wxIcon);
      }
    }
  }
  http.end();
}

// Connect using saved WiFi; if none/unreachable, open the "Kiibo" setup hotspot
// so the customer enters their own WiFi from a phone — no hardcoded credentials.
void connectWiFi()
{
  WiFi.mode(WIFI_STA);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180); // 3 min in setup mode, then reboot & retry
  wm.setAPCallback([](WiFiManager *mgr) { drawWifiSetupScreen(); });

  // Tries the saved network first; only opens the portal if it can't connect.
  bool ok = wm.autoConnect(SETUP_AP_NAME);
  if (!ok)
  {
    Serial.println("WiFi setup timed out - restarting");
    ESP.restart();
  }
  Serial.printf("WiFi OK  IP: %s  RSSI: %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

// Probe a bus for an SSD1306 at 0x3C or 0x3D; returns the address (or 0).
uint8_t probeOled(TwoWire &w)
{
  w.beginTransmission(0x3C);
  if (w.endTransmission() == 0) return 0x3C;
  w.beginTransmission(0x3D);
  if (w.endTransmission() == 0) return 0x3D;
  return 0;
}

void setup()
{
  Serial.begin(115200);
  delay(200);
  randomSeed(esp_random());

  Wire.begin();             // bus 1: SDA=D21, SCL=D22 (LEFT / eyes)
  Wire1.begin(SDA2, SCL2);  // bus 2: SDA=D33, SCL=D32 (RIGHT / dashboard)
  Wire.setClock(400000);    // fast I2C for smoother refresh
  Wire1.setClock(400000);

  // Auto-detect each panel's address (0x3C or 0x3D) — no jumper needed.
  uint8_t la = probeOled(Wire);
  uint8_t ra = probeOled(Wire1);
  bool leftOK = la && display.begin(SSD1306_SWITCHCAPVCC, la);
  hasRight = ra && displayR.begin(SSD1306_SWITCHCAPVCC, ra);
  Serial.printf("LEFT  bus1 (D21/D22) addr 0x%02X: %s\n", la, leftOK ? "ok" : "NOT FOUND");
  Serial.printf("RIGHT bus2 (D33/D32) addr 0x%02X: %s\n", ra, hasRight ? "ok" : "NOT FOUND");

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Kiibo");
  display.print("v");
  display.println(FW_VERSION);
  display.println("connecting...");
  display.display();
  if (hasRight)
  {
    displayR.clearDisplay();
    displayR.setTextColor(SSD1306_WHITE);
    displayR.setCursor(0, 0);
    displayR.println("Dashboard");
    displayR.println("starting...");
    displayR.display();
  }

  // design -> screen transform (same fit/center as the web canvas, *0.94)
  SCALE = min((float)SCREEN_WIDTH / DESIGN_W, (float)SCREEN_HEIGHT / DESIGN_H) * EYE_ZOOM;
  OFFX = (SCREEN_WIDTH - DESIGN_W * SCALE) / 2.0f;
  OFFY = (SCREEN_HEIGHT - DESIGN_H * SCALE) / 2.0f;

  connectWiFi();
  startNtp(); // begin NTP sync for time/date widgets

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET; // no Auth provider needed
  config.token_status_callback = tokenStatusCallback;  // from TokenHelper.h

  Firebase.reconnectWiFi(true);
  Firebase.begin(&config, &auth);

  String devicePath = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID;
  if (!Firebase.RTDB.beginStream(&stream, devicePath.c_str()))
    Serial.printf("beginStream failed: %s\n", stream.errorReason().c_str());
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
  Serial.printf("Streaming %s\n", devicePath.c_str());
  firebaseReady = true;
}

void loop()
{
  drawFrame(); // cycles the playlist on its own; stream updates arrive via callback

  // Periodic OTA check (and once shortly after boot). update()/reboot is
  // blocking, but only runs when a newer version is actually published.
  if (firebaseReady && Firebase.ready())
  {
    // Heartbeat + diagnostics (so the app/DB can see the device is alive,
    // how many slides it parsed, and that it's online).
    if (millis() - lastBeat > 5000)
    {
      lastBeat = millis();
      String b = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID;
      Firebase.RTDB.setIntAsync(&fbdo, (b + "/slideCount").c_str(), slideCount);
      Firebase.RTDB.setIntAsync(&fbdo, (b + "/uptime").c_str(), (int)(millis() / 1000));
      Firebase.RTDB.setBoolAsync(&fbdo, (b + "/online").c_str(), true);
    }

    // Auto-fetch weather (on city change, then every 15 min). Blocks briefly.
    if (needWeather || millis() - lastWeather > 900000UL)
    {
      needWeather = false;
      lastWeather = millis();
      fetchWeather();
    }

    // Fetch the playlist cleanly (the stream's copy is escaped JSON)
    if (needPlaylistFetch)
    {
      needPlaylistFetch = false;
      String base = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID;
      if (Firebase.RTDB.getString(&fbdo, (base + "/playlistJson").c_str()))
      {
        parsePlaylist(fbdo.stringData());
        reportCurSlide(); // publish slide 0 right away so the app preview syncs
      }
      if (Firebase.RTDB.getInt(&fbdo, (base + "/cycleMs").c_str()))
      {
        int ms = fbdo.intData();
        if (ms >= 500) cycleMs = (unsigned long)ms;
      }
    }

    // --- Self-heal sync ---------------------------------------------------
    // The realtime stream can silently drop on ESP32 (heap/SSL), which would
    // freeze the rotation and make "update now" never fire. So we ALSO re-read
    // the small control fields directly, one per tick (to avoid animation
    // hitches), so the device recovers on its own within ~30s of any drop and
    // picks up the rotation list immediately at boot.
    static unsigned long lastSync = 0;
    static int syncStep = 0;
    static String lastEmoCsv = "\x01"; // sentinel so the first read always applies
    if (lastSync == 0 || millis() - lastSync > 6000UL)
    {
      lastSync = millis();
      String b = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID;
      switch (syncStep)
      {
        case 0:
          if (Firebase.RTDB.getString(&fbdo, (b + "/emotionList").c_str()))
          {
            String v = fbdo.stringData(); v.replace("\"", ""); v.trim();
            if (v != lastEmoCsv) { lastEmoCsv = v; parseEmotionList(v); }
          }
          break;
        case 1:
          if (Firebase.RTDB.getBool(&fbdo, (b + "/fwUpdateNow").c_str()) && fbdo.boolData())
            forceOtaCheck = true;
          break;
        case 2:
          if (Firebase.RTDB.getBool(&fbdo, (b + "/musPlaying").c_str()))
            musPlaying = fbdo.boolData();
          break;
        case 3:
          if (Firebase.RTDB.getString(&fbdo, (b + "/musTitle").c_str()))
          { String v = fbdo.stringData(); v.replace("\"", ""); v.trim(); musTitle = v; }
          break;
        case 4:
          if (Firebase.RTDB.getString(&fbdo, (b + "/musArtist").c_str()))
          { String v = fbdo.stringData(); v.replace("\"", ""); v.trim(); musArtist = v; }
          break;
      }
      syncStep = (syncStep + 1) % 5;
    }

    // "Update now" from the app -> check immediately
    if (forceOtaCheck)
    {
      forceOtaCheck = false;
      String f = String("/") + ROOT_PATH + "/devices/" + DEVICE_ID + "/fwUpdateNow";
      Firebase.RTDB.setBool(&fbdo, f.c_str(), false); // clear the trigger
      lastOtaCheck = millis();
      checkForOTA();
    }
    // Background auto-check (and once shortly after boot)
    else if (lastOtaCheck == 0 || millis() - lastOtaCheck > OTA_INTERVAL)
    {
      lastOtaCheck = millis();
      checkForOTA();
    }
  }

  delay(16); // ~60 fps cap
}
