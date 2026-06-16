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
#define FW_VERSION "2.0.0"

// OLED — two 128x64 panels on the same I2C bus.
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C   // LEFT  panel = robot eyes / emotions
#define OLED_ADDR_R 0x3D // RIGHT panel = smart dashboard

// Eye size. 1.0 = whole 800x480 design fits (small eyes, lots of margin).
// Higher = zoomed-in / bigger eyes. ~1.7 fills the panel; try 1.5 - 2.2.
#define EYE_ZOOM 1.7f

// Corner rounding in design units (web app uses 25). 0 = sharp corners.
// "Slightly rounded" ~12-18; full app look ~25.
#define EYE_RADIUS 16.0f
// ======================================================

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);   // LEFT (eyes)
Adafruit_SSD1306 displayR(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);  // RIGHT (dashboard)
bool hasRight = false; // set true if the 0x3D panel is detected

// V2 emotion set — declared up top so Arduino's auto-prototypes see the type.
enum Emotion {
  EMO_IDLE, EMO_HAPPY, EMO_SLEEP, EMO_WAKE, EMO_LISTENING,
  EMO_THINKING, EMO_CURIOUS, EMO_EXCITED, EMO_LOVE, EMO_MUSIC
};

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
float musicBeat = 0; // 0..1, set from Firebase music data in a later phase

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
  return EMO_IDLE;
}

void setEmotion(const String &name)
{
  Emotion e = emotionFromName(name);
  if (e != emotion) { emotion = e; emotionStart = millis(); }
}

// music beat level 0..1 (placeholder gentle pulse until the music feed is wired)
float beatLevel() { return musicBeat > 0 ? musicBeat : (sinf(millis() / 220.0f) + 1) * 0.5f; }

// one rounded-rect eye; height clamped so blinks stay a thin line, not gone
static void drawEye(float cx, float cy, float w, float h)
{
  int iw = (int)lroundf(w);
  int ih = (int)lroundf(max(2.0f, h));
  int r = min(min(EYE_CORNER, iw / 2), ih / 2);
  display.fillRoundRect((int)lroundf(cx - iw / 2.0f), (int)lroundf(cy - ih / 2.0f), iw, ih, r, SSD1306_WHITE);
}

// LEFT panel — render the current emotion's animated eyes.
void drawEyes(unsigned long t)
{
  const float w = 34, h = 40, gap = 16, cy = 32;
  float lcx = SCREEN_WIDTH / 2.0f - gap / 2 - w / 2;
  float rcx = SCREEN_WIDTH / 2.0f + gap / 2 + w / 2;
  float lw = w, lh = h, rw = w, rh = h, loff = 0, roff = 0, lxo = 0, rxo = 0;
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
  }

  float bf = 1.0f;
  bool canBlink = (emotion != EMO_SLEEP && emotion != EMO_WAKE);
  if (canBlink && t > nextBlink2 && !blinking2) { blinking2 = true; blinkStart2 = t; nextBlink2 = t + (unsigned long)rr(2500, 6000); }
  if (blinking2)
  {
    unsigned long be = t - blinkStart2; const float d = 140;
    if (be < d / 2) bf = 1.0f - (be / (d / 2)) * 0.92f;
    else if (be < d) bf = 0.08f + ((be - d / 2) / (d / 2)) * 0.92f;
    else blinking2 = false;
  }

  display.clearDisplay();
  drawEye(lcx + lxo, cy + loff, lw, lh * bf);
  drawEye(rcx + rxo, cy + roff, rw, rh * bf);
  display.display();
}

// RIGHT panel — Phase 1 dashboard: big clock + date (weather/music in Phase 2).
void drawDashboard(unsigned long t)
{
  if (!hasRight) return;
  applyTimezoneIfChanged();
  struct tm tm;
  bool have = localNow(tm);
  int16_t x1, y1; uint16_t tw, th;

  displayR.clearDisplay();
  displayR.setTextColor(SSD1306_WHITE);

  if (have)
  {
    static const char *wd[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
    static const char *mo[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};
    char d[20];
    snprintf(d, sizeof(d), "%s %s %d", wd[tm.tm_wday], mo[tm.tm_mon], tm.tm_mday);
    displayR.setTextSize(1);
    displayR.getTextBounds(d, 0, 0, &x1, &y1, &tw, &th);
    displayR.setCursor((SCREEN_WIDTH - tw) / 2, 6);
    displayR.print(d);
  }

  String hhmm = have ? widgetTimeText(tm) : String("--:--");
  displayR.setTextSize(2);
  displayR.getTextBounds(hhmm, 0, 0, &x1, &y1, &tw, &th);
  displayR.setCursor((SCREEN_WIDTH - tw) / 2, 26);
  displayR.print(hhmm);

  displayR.setTextSize(1);
  displayR.setCursor(0, 54);
  displayR.print("Kiibo v2");
  displayR.display();
}

// Top-level frame: eyes every loop (smooth), dashboard ~2 Hz (clock).
void drawFrame()
{
  unsigned long t = millis();
  drawEyes(t);
  static unsigned long lastDash = 0;
  if (millis() - lastDash > 500) { lastDash = millis(); drawDashboard(t); }
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

void setup()
{
  Serial.begin(115200);
  delay(200);
  randomSeed(esp_random());

  Wire.begin(); // SDA=21, SCL=22 on most ESP32 boards
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR))
  {
    Serial.println("SSD1306 not found - check wiring / address (0x3C or 0x3D)");
    for (;;)
      delay(1000);
  }
  // Second panel (right = dashboard). Optional — runs single-panel if absent.
  hasRight = displayR.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR_R);
  Serial.printf("Right panel (0x3D): %s\n", hasRight ? "found" : "not found");

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
