#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// =====================================================
// WIFI CONFIGURATION
// =====================================================

const char* WIFI_SSID     = "Gangadhar";
const char* WIFI_PASSWORD = "gangu123";

// =====================================================
// WEBSOCKET SERVER CONFIGURATION
// =====================================================

const char* WS_HOST       = "2c1d-2409-40f2-101f-d188-5663-b267-fe5b-3dd6.ngrok-free.app";
const uint16_t WS_PORT    = 443;
const char* WS_PATH       = "/ws";

// =====================================================
// ROBOT CREDENTIALS
// =====================================================

const char* ROBOT_ID      = "robot_prash_001";
const char* ROBOT_SECRET  = "a8jH2diBDteEx6AL-KiuFeGSBavxbhkaDszHaMrhkuQ";

// =====================================================
// GLOBAL WEBSOCKET CLIENT & STATE
// =====================================================

WebSocketsClient webSocket;
bool wsConnected = false;
bool robotRegistered = false;

// =====================================================
// PCA9685 SERVO DRIVER CONFIGURATION
// =====================================================

#define PCA9685_ADDRESS 0x40
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(PCA9685_ADDRESS);

#define I2C_SDA 21
#define I2C_SCL 22

// PCA9685 Channels
#define PAN_SERVO_CHANNEL       0
#define TILT_SERVO_CHANNEL      1
#define SPRAY_SERVO_1_CHANNEL   2
#define SPRAY_SERVO_2_CHANNEL   3

#define SERVO_FREQ 50
#define SERVO_MIN_PULSE 500
#define SERVO_MAX_PULSE 2500

// Camera Servo Limits & Step
#define CAMERA_STEP 10
#define PAN_MIN_ANGLE 10
#define PAN_MAX_ANGLE 170
#define TILT_MIN_ANGLE 10
#define TILT_MAX_ANGLE 170

int panAngle = 90;
int tiltAngle = 90;

// Spray Servo Angles
#define SPRAY_OFF_ANGLE 0
#define SPRAY_ON_ANGLE  90

bool sprayState = false;

// =====================================================
// FUNCTION DECLARATIONS
// =====================================================

void connectWiFi();
void setupPCA9685();
void setupWebSocket();
void sendRegistration();
void sendStatus(const char* status);
void sendServoEvent(const char* eventName);
void handleCameraCommand(const char* command, int angle = -1);
void centerCamera();
void cameraLeft();
void cameraRight();
void cameraUp();
void cameraDown();
void sprayOn();
void sprayOff();
uint16_t angleToPulse(int angle);
void setServoAngle(uint8_t channel, int angle);

// =====================================================
// WIFI CONNECTION
// =====================================================

void connectWiFi() {
  Serial.println();
  Serial.println("========================================");
  Serial.println("[WIFI] Connecting...");
  Serial.print("[WIFI] SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;

    if (attempts >= 60) {
      Serial.println();
      Serial.println("[WIFI] Connection timeout");
      return;
    }
  }

  Serial.println();
  Serial.println("[WIFI] Connected!");
  Serial.print("[WIFI] IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("[WIFI] RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.println("========================================");
}

// =====================================================
// SERVO PWM CONVERSION
// =====================================================

uint16_t angleToPulse(int angle) {
  angle = constrain(angle, 0, 180);
  long pulseWidth = map(angle, 0, 180, SERVO_MIN_PULSE, SERVO_MAX_PULSE);
  uint16_t pulse = (uint16_t)(pulseWidth * 4096L / 20000L);
  return pulse;
}

void setServoAngle(uint8_t channel, int angle) {
  angle = constrain(angle, 0, 180);
  uint16_t pulse = angleToPulse(angle);
  pwm.setPWM(channel, 0, pulse);

  Serial.print("[SERVO] CH");
  Serial.print(channel);
  Serial.print(" -> ");
  Serial.print(angle);
  Serial.print("° | PWM=");
  Serial.println(pulse);
}

// =====================================================
// CAMERA SERVO CONTROL
// =====================================================

void centerCamera() {
  panAngle = 90;
  tiltAngle = 90;
  setServoAngle(PAN_SERVO_CHANNEL, panAngle);
  setServoAngle(TILT_SERVO_CHANNEL, tiltAngle);
  Serial.println("[CAMERA] CENTER (90°, 90°)");
}

void cameraLeft() {
  panAngle = constrain(panAngle - CAMERA_STEP, PAN_MIN_ANGLE, PAN_MAX_ANGLE);
  setServoAngle(PAN_SERVO_CHANNEL, panAngle);
  Serial.print("[CAMERA] LEFT -> ");
  Serial.println(panAngle);
}

void cameraRight() {
  panAngle = constrain(panAngle + CAMERA_STEP, PAN_MIN_ANGLE, PAN_MAX_ANGLE);
  setServoAngle(PAN_SERVO_CHANNEL, panAngle);
  Serial.print("[CAMERA] RIGHT -> ");
  Serial.println(panAngle);
}

void cameraUp() {
  tiltAngle = constrain(tiltAngle + CAMERA_STEP, TILT_MIN_ANGLE, TILT_MAX_ANGLE);
  setServoAngle(TILT_SERVO_CHANNEL, tiltAngle);
  Serial.print("[CAMERA] UP -> ");
  Serial.println(tiltAngle);
}

void cameraDown() {
  tiltAngle = constrain(tiltAngle - CAMERA_STEP, TILT_MIN_ANGLE, TILT_MAX_ANGLE);
  setServoAngle(TILT_SERVO_CHANNEL, tiltAngle);
  Serial.print("[CAMERA] DOWN -> ");
  Serial.println(tiltAngle);
}

// =====================================================
// SPRAY SERVO CONTROL
// =====================================================

void sprayOn() {
  sprayState = true;
  setServoAngle(SPRAY_SERVO_1_CHANNEL, SPRAY_ON_ANGLE);
  setServoAngle(SPRAY_SERVO_2_CHANNEL, SPRAY_ON_ANGLE);
  Serial.println("[SPRAY] ON");
  sendServoEvent("SPRAY_ON");
}

void sprayOff() {
  sprayState = false;
  setServoAngle(SPRAY_SERVO_1_CHANNEL, SPRAY_OFF_ANGLE);
  setServoAngle(SPRAY_SERVO_2_CHANNEL, SPRAY_OFF_ANGLE);
  Serial.println("[SPRAY] OFF");
  sendServoEvent("SPRAY_OFF");
}

// =====================================================
// CAMERA COMMAND DISPATCHER
// =====================================================

void handleCameraCommand(const char* command, int angle) {
  if (!command || strlen(command) == 0) {
    Serial.println("[SERVO] Empty camera command");
    return;
  }

  Serial.print("[SERVO COMMAND] ");
  Serial.print(command);
  if (angle >= 0) {
    Serial.print(" (angle: ");
    Serial.print(angle);
    Serial.print(")");
  }
  Serial.println();

  if (strcasecmp(command, "UP") == 0) {
    if (angle >= 0) {
      tiltAngle = constrain(angle, TILT_MIN_ANGLE, TILT_MAX_ANGLE);
      setServoAngle(TILT_SERVO_CHANNEL, tiltAngle);
    } else {
      cameraUp();
    }
  } else if (strcasecmp(command, "DOWN") == 0) {
    if (angle >= 0) {
      tiltAngle = constrain(angle, TILT_MIN_ANGLE, TILT_MAX_ANGLE);
      setServoAngle(TILT_SERVO_CHANNEL, tiltAngle);
    } else {
      cameraDown();
    }
  } else if (strcasecmp(command, "LEFT") == 0) {
    if (angle >= 0) {
      panAngle = constrain(angle, PAN_MIN_ANGLE, PAN_MAX_ANGLE);
      setServoAngle(PAN_SERVO_CHANNEL, panAngle);
    } else {
      cameraLeft();
    }
  } else if (strcasecmp(command, "RIGHT") == 0) {
    if (angle >= 0) {
      panAngle = constrain(angle, PAN_MIN_ANGLE, PAN_MAX_ANGLE);
      setServoAngle(PAN_SERVO_CHANNEL, panAngle);
    } else {
      cameraRight();
    }
  } else if (strcasecmp(command, "CENTER") == 0) {
    centerCamera();
  } else if (strcasecmp(command, "PAN") == 0 && angle >= 0) {
    panAngle = constrain(angle, PAN_MIN_ANGLE, PAN_MAX_ANGLE);
    setServoAngle(PAN_SERVO_CHANNEL, panAngle);
  } else if (strcasecmp(command, "TILT") == 0 && angle >= 0) {
    tiltAngle = constrain(angle, TILT_MIN_ANGLE, TILT_MAX_ANGLE);
    setServoAngle(TILT_SERVO_CHANNEL, tiltAngle);
  } else {
    Serial.print("[SERVO] Unknown camera command: ");
    Serial.println(command);
  }
}

// =====================================================
// REGISTRATION & MESSAGING HELPERS
// =====================================================

void sendRegistration() {
  if (!wsConnected) return;

  JsonDocument doc;
  doc["type"] = "robot:register";
  doc["client"] = "robot";
  doc["robotId"] = ROBOT_ID;
  doc["secret"] = ROBOT_SECRET;

  JsonArray roles = doc["roles"].to<JsonArray>();
  roles.add("SERVO");

  String registration;
  serializeJson(doc, registration);

  Serial.println();
  Serial.println("[ROBOT] Sending registration...");
  Serial.println("[ROBOT OUT] robot:register robotId=" + String(ROBOT_ID) + " role=SERVO");

  webSocket.sendTXT(registration);
}

void sendStatus(const char* status) {
  if (!wsConnected || !robotRegistered) return;

  JsonDocument doc;
  doc["type"] = "robot:status";
  doc["robotId"] = ROBOT_ID;
  doc["role"] = "SERVO";
  doc["status"] = status;

  String message;
  serializeJson(doc, message);

  webSocket.sendTXT(message);

  Serial.print("[STATUS] ");
  Serial.println(status);
}

void sendServoEvent(const char* eventName) {
  if (!wsConnected || !robotRegistered) return;

  JsonDocument doc;
  doc["type"] = "servo:event";
  doc["robotId"] = ROBOT_ID;
  doc["event"] = eventName;

  String message;
  serializeJson(doc, message);

  webSocket.sendTXT(message);

  Serial.print("[SERVO EVENT SENT] ");
  Serial.println(eventName);
}

// =====================================================
// SERVER MESSAGE HANDLER
// =====================================================

void handleServerMessage(JsonDocument& doc) {
  const char* type = doc["type"] | "";

  if (strcmp(type, "robot:registered") == 0) {
    const char* robotId = doc["robotId"] | "";
    robotRegistered = true;

    Serial.println();
    Serial.println("========================================");
    Serial.println("[ROBOT] REGISTERED SUCCESSFULLY");
    Serial.print("Robot ID: ");
    Serial.println(robotId);
    Serial.println("Role: SERVO");
    Serial.println("========================================");

    sendStatus("online");
    return;
  }

  if (strcmp(type, "COMMAND") == 0) {
    JsonObject data = doc["data"];
    if (data.isNull()) {
      Serial.println("[WS ERROR] COMMAND missing data block");
      return;
    }

    const char* command = data["command"] | "";
    const char* state = data["state"] | "";
    int angle = data["angle"] | -1;
    const char* requestId = data["requestId"] | "";

    Serial.println();
    Serial.println("==============================");
    Serial.println("[SERVO COMMAND RECEIVED]");
    Serial.print("Command: ");
    Serial.println(command);
    if (strlen(state) > 0) {
      Serial.print("State: ");
      Serial.println(state);
    }
    if (angle >= 0) {
      Serial.print("Angle: ");
      Serial.println(angle);
    }
    Serial.print("Request ID: ");
    Serial.println(requestId);
    Serial.println("==============================");

    // -------------------------------------------------
    // SPRAY COMMAND
    // -------------------------------------------------
    if (strcasecmp(command, "SPRAY") == 0) {
      if (strcasecmp(state, "ON") == 0) {
        sprayOn();
      } else if (strcasecmp(state, "OFF") == 0) {
        sprayOff();
      } else {
        Serial.print("[SPRAY] Unknown state: ");
        Serial.println(state);
      }
      return;
    }

    // -------------------------------------------------
    // CAMERA SERVO COMMAND
    // -------------------------------------------------
    handleCameraCommand(command, angle);
    return;
  }

  if (strcmp(type, "ERROR") == 0) {
    const char* errorMessage = doc["message"] | "Unknown error";
    Serial.print("[SERVER ERROR] ");
    Serial.println(errorMessage);
    if (!robotRegistered) {
      sprayOff();
    }
    return;
  }

  Serial.print("[WS] Unknown event type: ");
  Serial.println(type);
}

// =====================================================
// WEBSOCKET EVENT CALLBACK
// =====================================================

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println();
      Serial.println("========================================");
      Serial.println("[WS] WSS CONNECTED (SERVO Module)");
      Serial.println("========================================");

      wsConnected = true;
      robotRegistered = false;
      sendRegistration();
      break;

    case WStype_DISCONNECTED:
      Serial.println();
      Serial.println("[WS] WSS DISCONNECTED");
      wsConnected = false;
      robotRegistered = false;
      sprayOff();
      break;

    case WStype_TEXT:
      Serial.print("[WS IN] ");
      for (size_t i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
      }
      Serial.println();

      {
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload, length);
        if (error) {
          Serial.print("[JSON ERROR] ");
          Serial.println(error.c_str());
          return;
        }
        handleServerMessage(doc);
      }
      break;

    case WStype_BIN:
      Serial.println("[WS] Binary message ignored");
      break;

    case WStype_PING:
      Serial.println("[WS] PING");
      break;

    case WStype_PONG:
      Serial.println("[WS] PONG");
      break;

    case WStype_ERROR:
      Serial.println("[WS] ERROR");
      break;
  }
}

// =====================================================
// PCA9685 SETUP
// =====================================================

void setupPCA9685() {
  Serial.println();
  Serial.println("[PCA9685] Initializing...");

  Wire.begin(I2C_SDA, I2C_SCL);

  if (!pwm.begin()) {
    Serial.println("[PCA9685] ERROR: Not detected!");
    return;
  }

  pwm.setPWMFreq(SERVO_FREQ);
  delay(100);

  Serial.println("[PCA9685] Ready");
  centerCamera();
  sprayOff();
  Serial.println("[PCA9685] Initial positions set");
}

// =====================================================
// WEBSOCKET SETUP
// =====================================================

void setupWebSocket() {
  Serial.println();
  Serial.println("========================================");
  Serial.println("[WS] Initializing WSS...");
  Serial.print("[WS] Host: ");
  Serial.println(WS_HOST);
  Serial.print("[WS] Port: ");
  Serial.println(WS_PORT);
  Serial.print("[WS] Path: ");
  Serial.println(WS_PATH);

  // beginSSL without a fingerprint skips cert validation (fine for ngrok)
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);

  // ngrok free tier shows a browser warning page for new HTTP connections.
  // This header tells ngrok to skip the interstitial and pass the WS upgrade
  // directly to the backend — without it the handshake returns HTML and
  // the ESP32 disconnects immediately.
  webSocket.setExtraHeaders("ngrok-skip-browser-warning: true");

  webSocket.setReconnectInterval(3000);

  // Heartbeat: ping every 25s, pong timeout 10s, allow 3 missed pongs
  // Generous values to tolerate ngrok's variable tunnel latency
  webSocket.enableHeartbeat(25000, 10000, 3);

  Serial.println("[WS] WSS initialized");
  Serial.println("========================================");
}

// =====================================================
// ARDUINO SETUP & LOOP
// =====================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==========================================");
  Serial.println("       ROBOT SERVO MODULE");
  Serial.println("       ESP32 + PCA9685");
  Serial.println("==========================================");

  setupPCA9685();
  connectWiFi();
  setupWebSocket();
}

void loop() {
  webSocket.loop();

  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiAttempt = 0;
    if (millis() - lastWifiAttempt > 5000) {
      lastWifiAttempt = millis();
      Serial.println("[WIFI] Connection lost");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  delay(5);
}