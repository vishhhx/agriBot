#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// =====================================================
// WIFI CONFIGURATION
// =====================================================
const char* WIFI_SSID = "Gangadhar";
const char* WIFI_PASSWORD = "gangu123";


// =====================================================
// WEBSOCKET SERVER
// =====================================================
// Backend Local Server:
// http://localhost:5000
//
// WebSocket:
// ws://localhost:5000/ws
//

const char* WS_HOST =
    "rf3pnggh-5000.inc1.devtunnels.ms";

const uint16_t WS_PORT = 443;

const char* WS_PATH = "/ws";


// =====================================================
// ROBOT
// =====================================================

const char* ROBOT_ID =
    "robot_prash_001";


// IMPORTANT:
//
// This is the RAW secret.
// Do NOT put the bcrypt hash here.
//
// MongoDB:
// robotSecretHash = $2b$12$...
//
// ESP32:
// ROBOT_SECRET = original raw secret
//

const char* ROBOT_SECRET =
  "skhtpAftcrkL-ujQK_9-Hxxo9dpeauBuHuSBcQmcQzI";


// =====================================================
// WEBSOCKET
// =====================================================

WebSocketsClient webSocket;

bool wsConnected = false;
bool robotRegistered = false;

// =====================================================
// L298N MOTOR DRIVER PINS
// =====================================================

// Pump 1
// Water Source -> Tank
#define REFILL_IN1 25
#define REFILL_IN2 26

// Pump 2
// Tank -> Spray
#define SPRAY_IN1 27
#define SPRAY_IN2 14

// =====================================================
// ULTRASONIC SENSOR & WATER LEVEL
// =====================================================

#define ULTRASONIC_TRIG 32
#define ULTRASONIC_ECHO 33

// Tank is considered FULL when water surface is 2 inches (5.08 cm) or closer
#define TANK_FULL_DISTANCE_CM 5.08
#define TANK_EMPTY_DISTANCE_CM 40.0

// =====================================================
// PUMP & WATER STATES
// =====================================================

bool refillPumpState = false;
bool sprayPumpState = false;

bool sensorPresent = false;
bool tankFull = false;
float currentWaterDistance = -1.0;
int currentWaterPercent = 0;

unsigned long lastUltrasonicCheck = 0;
const unsigned long ULTRASONIC_INTERVAL = 300;

// =====================================================
// FUNCTION DECLARATIONS
// =====================================================

void connectWiFi();
void setupMotors();
void setupUltrasonic();
void setupWebSocket();

void sendRegistration();
void sendStatus(const char* status);
void sendWaterEvent(const char* eventName);

void refillPumpOn();
void refillPumpOff();

void sprayPumpOn();
void sprayPumpOff();

void stopAllPumps();

float getWaterDistance();
void checkWaterLevel();

void handleServerMessage(JsonDocument& doc);

void webSocketEvent(
  WStype_t type,
  uint8_t* payload,
  size_t length
);

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

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

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

  Serial.println(
    WiFi.localIP()
  );

  Serial.println(
    "========================================"
  );
}

// =====================================================
// MOTOR SETUP
// =====================================================

void setupMotors() {

  pinMode(
    REFILL_IN1,
    OUTPUT
  );

  pinMode(
    REFILL_IN2,
    OUTPUT
  );

  pinMode(
    SPRAY_IN1,
    OUTPUT
  );

  pinMode(
    SPRAY_IN2,
    OUTPUT
  );

  // Make sure both pumps are OFF

  stopAllPumps();

  Serial.println(
    "[MOTOR] L298N Motor Driver Ready"
  );
}

// =====================================================
// ULTRASONIC SETUP & DISTANCE MEASUREMENT
// =====================================================

void setupUltrasonic() {
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);
  digitalWrite(ULTRASONIC_TRIG, LOW);
  Serial.println("[ULTRASONIC] Sensor Initialized (Trig=32, Echo=33)");
}

float getWaterDistance() {
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);

  long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 10000); // 10ms timeout (~1.7m max)
  if (duration == 0) {
    return -1.0; // Sensor not connected or timed out
  }

  float distance = duration * 0.0343 / 2.0;
  if (distance < 1.0 || distance > 400.0) {
    return -1.0; // Invalid reading
  }

  return distance;
}

// =====================================================
// REFILL PUMP
// =====================================================

void refillPumpOn() {
  if (sensorPresent && (tankFull || currentWaterPercent >= 90)) {
    Serial.print("[REFILL BLOCKED] Tank is already at ");
    Serial.print(currentWaterPercent);
    Serial.println("% capacity (>= 90%)");
    sendWaterEvent("TANK_FULL");
    return;
  }

  digitalWrite(REFILL_IN1, HIGH);
  digitalWrite(REFILL_IN2, LOW);

  refillPumpState = true;

  Serial.println("[REFILL] PUMP ON");

  sendWaterEvent("REFILL_STARTED");
}

void refillPumpOff() {
  digitalWrite(REFILL_IN1, LOW);
  digitalWrite(REFILL_IN2, LOW);

  bool wasRunning = refillPumpState;
  refillPumpState = false;

  Serial.println("[REFILL] PUMP OFF");

  if (wasRunning) {
    sendWaterEvent("REFILL_STOPPED");
  }
}

// =====================================================
// SPRAY PUMP
// =====================================================

void sprayPumpOn() {
  digitalWrite(SPRAY_IN1, HIGH);
  digitalWrite(SPRAY_IN2, LOW);

  sprayPumpState = true;

  Serial.println("[SPRAY] PUMP ON");

  sendWaterEvent("SPRAY_STARTED");
}

void sprayPumpOff() {
  digitalWrite(SPRAY_IN1, LOW);
  digitalWrite(SPRAY_IN2, LOW);

  bool wasRunning = sprayPumpState;
  sprayPumpState = false;

  Serial.println("[SPRAY] PUMP OFF");

  if (wasRunning) {
    sendWaterEvent("SPRAY_STOPPED");
  }
}

// =====================================================
// STOP ALL PUMPS
// =====================================================

void stopAllPumps() {
  digitalWrite(REFILL_IN1, LOW);
  digitalWrite(REFILL_IN2, LOW);

  digitalWrite(SPRAY_IN1, LOW);
  digitalWrite(SPRAY_IN2, LOW);

  refillPumpState = false;
  sprayPumpState = false;

  Serial.println("[MOTOR] ALL PUMPS STOPPED");
}

// =====================================================
// WATER LEVEL MONITOR (ULTRASONIC REACTIVE AUTO-STOP & TELEMETRY)
// =====================================================

unsigned long lastTelemetrySend = 0;
const unsigned long TELEMETRY_INTERVAL = 1000; // Send tank telemetry every 1s

void checkWaterLevel() {
  if (millis() - lastUltrasonicCheck < ULTRASONIC_INTERVAL) return;
  lastUltrasonicCheck = millis();

  float distance = getWaterDistance();

  if (distance < 0) {
    if (sensorPresent) {
      sensorPresent = false;
      tankFull = false;
      currentWaterDistance = -1.0;
      currentWaterPercent = 0;
      Serial.println("[ULTRASONIC] Sensor missing / not detected - Sensor features disabled");
      sendWaterEvent("SENSOR_DISCONNECTED");
    }
    return;
  }

  // Sensor is present and returning valid readings
  if (!sensorPresent) {
    sensorPresent = true;
    Serial.println("[ULTRASONIC] Sensor detected!");
  }

  // Smooth raw distance (exponential moving average)
  if (currentWaterDistance < 0) {
    currentWaterDistance = distance;
  } else {
    currentWaterDistance = (0.7f * distance) + (0.3f * currentWaterDistance);
  }

  // Calculate percentage: 2 inches (5.08 cm) = 100%, 40 cm = 0%
  if (currentWaterDistance <= TANK_FULL_DISTANCE_CM) {
    currentWaterPercent = 100;
  } else if (currentWaterDistance >= TANK_EMPTY_DISTANCE_CM) {
    currentWaterPercent = 0;
  } else {
    currentWaterPercent = (int)(((TANK_EMPTY_DISTANCE_CM - currentWaterDistance) / (TANK_EMPTY_DISTANCE_CM - TANK_FULL_DISTANCE_CM)) * 100.0);
  }

  // Check 90% capacity cutoff limit (Auto-stop refill pump at 90%)
  if (currentWaterPercent >= 90) {
    if (!tankFull) {
      tankFull = true;
      Serial.print("[TANK FULL DETECTED] Water level reached ");
      Serial.print(currentWaterPercent);
      Serial.println("% (>= 90% threshold)");
      sendWaterEvent("TANK_FULL");
    }

    // Auto shut off refill motor when water reaches 90%
    if (refillPumpState) {
      refillPumpOff();
      Serial.print("[REFILL AUTO-STOP] Water level reached ");
      Serial.print(currentWaterPercent);
      Serial.println("% (auto-stopped at 90% threshold)!");
      sendWaterEvent("REFILL_AUTO_STOPPED");
    }
  } else {
    tankFull = false;
  }

  // Send periodic telemetry if 1.5s elapsed OR if distance changed significantly (>= 0.3cm)
  if (wsConnected && robotRegistered) {
    static float lastSentDistance = -999.0;
    bool timeElapsed = (millis() - lastTelemetrySend >= TELEMETRY_INTERVAL);
    bool distChanged = (fabs(currentWaterDistance - lastSentDistance) >= 0.3f);
    if (timeElapsed || distChanged) {
      lastTelemetrySend = millis();
      lastSentDistance = currentWaterDistance;
      sendWaterEvent("WATER_TELEMETRY");
    }
  }
}

// =====================================================
// WEBSOCKET REGISTRATION
// =====================================================

void sendRegistration() {
  if (!wsConnected) {
    return;
  }

  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"robot:register\",\"client\":\"robot\",\"robotId\":\"%s\",\"secret\":\"%s\",\"roles\":[\"WATER_PUMP\"]}",
    ROBOT_ID, ROBOT_SECRET
  );

  Serial.println("[ROBOT] Sending WATER registration...");
  webSocket.sendTXT(buf);
}

// =====================================================
// SEND STATUS
// =====================================================

void sendStatus(const char* status) {
  if (!wsConnected || !robotRegistered) {
    return;
  }

  char buf[180];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"robot:status\",\"robotId\":\"%s\",\"role\":\"WATER_PUMP\",\"status\":\"%s\"}",
    ROBOT_ID, status
  );

  webSocket.sendTXT(buf);
  Serial.print("[STATUS] ");
  Serial.println(status);
}

// =====================================================
// SEND WATER EVENT
// =====================================================

void sendWaterEvent(const char* eventName) {
  if (!wsConnected || !robotRegistered) {
    return;
  }

  char jsonBuf[256];
  snprintf(jsonBuf, sizeof(jsonBuf),
    "{\"type\":\"water:event\",\"robotId\":\"%s\",\"event\":\"%s\",\"refillPump\":%s,\"sprayPump\":%s,\"tankFull\":%s,\"waterDistanceCm\":%.2f,\"waterPercent\":%d,\"sensorPresent\":%s}",
    ROBOT_ID,
    eventName,
    refillPumpState ? "true" : "false",
    sprayPumpState ? "true" : "false",
    tankFull ? "true" : "false",
    currentWaterDistance,
    currentWaterPercent,
    sensorPresent ? "true" : "false"
  );

  webSocket.sendTXT(jsonBuf);

  // Suppress repetitive WATER_TELEMETRY logs to prevent Serial UART buffer flooding
  if (strcmp(eventName, "WATER_TELEMETRY") != 0) {
    Serial.print("[WATER EVENT SENT] ");
    Serial.print(eventName);
    Serial.print(" | Dist=");
    Serial.print(currentWaterDistance);
    Serial.print("cm | Full=");
    Serial.println(tankFull ? "YES" : "NO");
  }
}

// =====================================================
// HANDLE SERVER COMMAND
// =====================================================

void handleServerMessage(
  JsonDocument& doc
) {

  const char* type =
    doc["type"] | "";

  // -------------------------------------------------
  // ROBOT REGISTERED
  // -------------------------------------------------

  if (
    strcmp(
      type,
      "robot:registered"
    ) == 0
  ) {

    robotRegistered = true;

    Serial.println();
    Serial.println(
      "========================================"
    );

    Serial.println(
      "[ROBOT] WATER MODULE REGISTERED"
    );

    Serial.println(
      "Role: WATER"
    );

    Serial.println(
      "========================================"
    );

    sendStatus(
      "online"
    );

    return;
  }

  // -------------------------------------------------
  // COMMAND
  // -------------------------------------------------

  if (
    strcmp(
      type,
      "COMMAND"
    ) == 0
  ) {

    JsonObject data =
      doc["data"];

    if (data.isNull()) {

      Serial.println(
        "[WS ERROR] COMMAND missing data"
      );

      return;
    }

    const char* command =
      data["command"] | "";

    const char* state =
      data["state"] | "";

    Serial.println();
    Serial.println(
      "================================"
    );

    Serial.println(
      "[WATER COMMAND RECEIVED]"
    );

    Serial.print(
      "Command: "
    );

    Serial.println(
      command
    );

    Serial.print(
      "State: "
    );

    Serial.println(
      state
    );

    Serial.println(
      "================================"
    );

    // ---------------------------------------------
    // REFILL PUMP
    // ---------------------------------------------

    if (
      strcasecmp(
        command,
        "REFILL"
      ) == 0
    ) {

      if (
        strcasecmp(
          state,
          "ON"
        ) == 0
      ) {

        refillPumpOn();
      }

      else if (
        strcasecmp(
          state,
          "OFF"
        ) == 0
      ) {

        refillPumpOff();
      }

      else {

        Serial.println(
          "[REFILL] Unknown state"
        );
      }

      return;
    }

    // ---------------------------------------------
    // SPRAY PUMP
    // ---------------------------------------------

    if (
      strcasecmp(
        command,
        "SPRAY"
      ) == 0
    ) {

      if (
        strcasecmp(
          state,
          "ON"
        ) == 0
      ) {

        sprayPumpOn();
      }

      else if (
        strcasecmp(
          state,
          "OFF"
        ) == 0
      ) {

        sprayPumpOff();
      }

      else {

        Serial.println(
          "[SPRAY] Unknown state"
        );
      }

      return;
    }

    // ---------------------------------------------
    // STOP EVERYTHING
    // ---------------------------------------------

    if (
      strcasecmp(
        command,
        "STOP_ALL"
      ) == 0
    ) {

      refillPumpOff();

      sprayPumpOff();

      sendWaterEvent(
        "ALL_PUMPS_STOPPED"
      );

      return;
    }

    Serial.print(
      "[WATER] Unknown command: "
    );

    Serial.println(
      command
    );

    return;
  }

  // -------------------------------------------------
  // ERROR
  // -------------------------------------------------

  if (
    strcmp(
      type,
      "ERROR"
    ) == 0
  ) {

    const char* errorMessage =
      doc["message"] |
      "Unknown error";

    Serial.print(
      "[SERVER ERROR] "
    );

    Serial.println(
      errorMessage
    );

    // Safety stop

    stopAllPumps();

    return;
  }
}

// =====================================================
// WEBSOCKET CALLBACK
// =====================================================

void webSocketEvent(
  WStype_t type,
  uint8_t* payload,
  size_t length
) {

  switch (type) {

    // ------------------------------------------------
    // CONNECTED
    // ------------------------------------------------

    case WStype_CONNECTED:

      Serial.println();
      Serial.println(
        "========================================"
      );

      Serial.println(
        "[WS] WS CONNECTED - WATER MODULE"
      );

      Serial.println(
        "========================================"
      );

      wsConnected = true;

      robotRegistered = false;

      sendRegistration();

      break;

    // ------------------------------------------------
    // DISCONNECTED
    // ------------------------------------------------

    case WStype_DISCONNECTED:

      Serial.println();

      Serial.println(
        "[WS] DISCONNECTED"
      );

      wsConnected = false;

      robotRegistered = false;

      // SAFETY:
      // Stop both pumps

      stopAllPumps();

      break;

    // ------------------------------------------------
    // TEXT MESSAGE
    // ------------------------------------------------

    case WStype_TEXT:

      Serial.print("[WS IN] ");
      Serial.write(payload, length);
      Serial.println();

      {

        JsonDocument doc;

        DeserializationError error =
          deserializeJson(
            doc,
            (const char*)payload,
            length
          );

        if (error) {

          Serial.print(
            "[JSON ERROR] "
          );

          Serial.println(
            error.c_str()
          );

          return;
        }

        handleServerMessage(
          doc
        );
      }

      break;

    case WStype_ERROR:

      Serial.println(
        "[WS] ERROR"
      );

      stopAllPumps();

      break;

    default:

      break;
  }
}

// =====================================================
// WEBSOCKET SETUP
// =====================================================

void setupWebSocket() {

  Serial.println(
    "[WS] Initializing..."
  );

  if (WS_PORT == 443) {
    webSocket.beginSSL(
      WS_HOST,
      WS_PORT,
      WS_PATH
    );
  } else {
    webSocket.begin(
      WS_HOST,
      WS_PORT,
      WS_PATH
    );
  }

  webSocket.onEvent(
    webSocketEvent
  );

  webSocket.setReconnectInterval(
    3000
  );

  webSocket.enableHeartbeat(
    25000,
    10000,
    3
  );

  Serial.println(
    "[WS] Ready"
  );
}

// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "      ROBOT WATER MODULE"
  );

  Serial.println(
    " ESP32 + L298N + ULTRASONIC"
  );

  Serial.println(
    "========================================"
  );

  setupMotors();

  setupUltrasonic();

  connectWiFi();

  setupWebSocket();
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  webSocket.loop();

  checkWaterLevel();

  // Reconnect WiFi if disconnected

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    static unsigned long
      lastWifiAttempt = 0;

    if (
      millis() -
      lastWifiAttempt >
      5000
    ) {

      lastWifiAttempt =
        millis();

      Serial.println(
        "[WIFI] Connection lost"
      );

      WiFi.disconnect();

      WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
      );
    }
  }

  delay(5);
}