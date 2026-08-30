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
// Backend EC2 Server:
// http://3.6.221.61:5000
//
// WebSocket:
// ws://3.6.221.61:5000/ws
//

const char* WS_HOST =
    "3.6.221.61";

const uint16_t WS_PORT = 5000;

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
    "a8jH2diBDteEx6AL-KiuFeGSBavxbhkaDszHaMrhkuQ";


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
// ULTRASONIC SENSOR  (DISABLED)
// =====================================================

// #define ULTRASONIC_TRIG 32
// #define ULTRASONIC_ECHO 33

// Tank is considered FULL when water surface
// is 2 inches or closer to the sensor
// #define TANK_FULL_DISTANCE_CM 5.08

// =====================================================
// PUMP STATES
// =====================================================

bool refillPumpState = false;
bool sprayPumpState = false;

// bool tankFull = false;  // disabled — no ultrasonic

// unsigned long lastUltrasonicCheck = 0;       // disabled
// const unsigned long ULTRASONIC_INTERVAL = 300; // disabled

// =====================================================
// FUNCTION DECLARATIONS
// =====================================================

void connectWiFi();
void setupMotors();
// void setupUltrasonic();  // disabled
void setupWebSocket();

void sendRegistration();
void sendStatus(const char* status);
void sendWaterEvent(const char* eventName);

void refillPumpOn();
void refillPumpOff();

void sprayPumpOn();
void sprayPumpOff();

void stopAllPumps();

// float getWaterDistance();  // disabled
// void checkWaterLevel();    // disabled

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
// ULTRASONIC SETUP  (DISABLED)
// =====================================================

// void setupUltrasonic() {
//   pinMode(ULTRASONIC_TRIG, OUTPUT);
//   pinMode(ULTRASONIC_ECHO, INPUT);
//   digitalWrite(ULTRASONIC_TRIG, LOW);
//   Serial.println("[ULTRASONIC] Sensor Ready");
// }

// =====================================================
// GET WATER DISTANCE  (DISABLED)
// =====================================================

// float getWaterDistance() {
//   digitalWrite(ULTRASONIC_TRIG, LOW);
//   delayMicroseconds(2);
//   digitalWrite(ULTRASONIC_TRIG, HIGH);
//   delayMicroseconds(10);
//   digitalWrite(ULTRASONIC_TRIG, LOW);
//   long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 30000);
//   if (duration == 0) { return -1; }
//   float distance = duration * 0.0343 / 2;
//   return distance;
// }

// =====================================================
// REFILL PUMP
// =====================================================

void refillPumpOn() {

  // Ultrasonic tank-full check DISABLED — pump is fully manual.
  // Uncomment the block below to re-enable auto-stop:
  //
  // float distance = getWaterDistance();
  // if (distance > 0 && distance <= TANK_FULL_DISTANCE_CM) {
  //   Serial.println("[REFILL] Tank already full");
  //   tankFull = true;
  //   refillPumpOff();
  //   sendWaterEvent("TANK_FULL");
  //   return;
  // }

  // Start Pump 1

  digitalWrite(
    REFILL_IN1,
    HIGH
  );

  digitalWrite(
    REFILL_IN2,
    LOW
  );

  refillPumpState = true;

  Serial.println(
    "[REFILL] PUMP ON"
  );

  sendWaterEvent(
    "REFILL_STARTED"
  );
}

void refillPumpOff() {

  digitalWrite(
    REFILL_IN1,
    LOW
  );

  digitalWrite(
    REFILL_IN2,
    LOW
  );

  bool wasRunning =
    refillPumpState;

  refillPumpState = false;

  Serial.println(
    "[REFILL] PUMP OFF"
  );

  if (wasRunning) {

    sendWaterEvent(
      "REFILL_STOPPED"
    );
  }
}

// =====================================================
// SPRAY PUMP
// =====================================================

void sprayPumpOn() {

  digitalWrite(
    SPRAY_IN1,
    HIGH
  );

  digitalWrite(
    SPRAY_IN2,
    LOW
  );

  sprayPumpState = true;

  Serial.println(
    "[SPRAY] PUMP ON"
  );

  sendWaterEvent(
    "SPRAY_STARTED"
  );
}

void sprayPumpOff() {

  digitalWrite(
    SPRAY_IN1,
    LOW
  );

  digitalWrite(
    SPRAY_IN2,
    LOW
  );

  bool wasRunning =
    sprayPumpState;

  sprayPumpState = false;

  Serial.println(
    "[SPRAY] PUMP OFF"
  );

  if (wasRunning) {

    sendWaterEvent(
      "SPRAY_STOPPED"
    );
  }
}

// =====================================================
// STOP ALL PUMPS
// =====================================================

void stopAllPumps() {

  digitalWrite(
    REFILL_IN1,
    LOW
  );

  digitalWrite(
    REFILL_IN2,
    LOW
  );

  digitalWrite(
    SPRAY_IN1,
    LOW
  );

  digitalWrite(
    SPRAY_IN2,
    LOW
  );

  refillPumpState = false;

  sprayPumpState = false;

  Serial.println(
    "[MOTOR] ALL PUMPS STOPPED"
  );
}

// =====================================================
// WATER LEVEL MONITOR  (DISABLED)
// =====================================================

// Ultrasonic auto-stop is disabled.
// Re-enable by uncommenting this function and the
// checkWaterLevel() call in loop().
//
// void checkWaterLevel() {
//   if (millis() - lastUltrasonicCheck < ULTRASONIC_INTERVAL) return;
//   lastUltrasonicCheck = millis();
//   float distance = getWaterDistance();
//   if (distance < 0) return;
//   Serial.print("[WATER LEVEL] Distance: ");
//   Serial.print(distance);
//   Serial.println(" cm");
//   if (distance <= TANK_FULL_DISTANCE_CM) {
//     if (!tankFull) {
//       tankFull = true;
//       Serial.println("[TANK] FULL");
//       sendWaterEvent("TANK_FULL");
//     }
//     if (refillPumpState) {
//       refillPumpOff();
//       sendWaterEvent("REFILL_AUTO_STOPPED");
//     }
//   } else {
//     tankFull = false;
//   }
// }

// =====================================================
// WEBSOCKET REGISTRATION
// =====================================================

void sendRegistration() {

  if (!wsConnected) {

    return;
  }

  JsonDocument doc;

  doc["type"] =
    "robot:register";

  doc["client"] =
    "robot";

  doc["robotId"] =
    ROBOT_ID;

  doc["secret"] =
    ROBOT_SECRET;

  JsonArray roles =
    doc["roles"]
      .to<JsonArray>();

  roles.add(
    "WATER_PUMP"
  );

  String registration;

  serializeJson(
    doc,
    registration
  );

  Serial.println(
    "[ROBOT] Sending WATER registration..."
  );

  webSocket.sendTXT(
    registration
  );
}

// =====================================================
// SEND STATUS
// =====================================================

void sendStatus(
  const char* status
) {

  if (
    !wsConnected ||
    !robotRegistered
  ) {

    return;
  }

  JsonDocument doc;

  doc["type"] =
    "robot:status";

  doc["robotId"] =
    ROBOT_ID;

  doc["role"] =
    "WATER_PUMP";

  doc["status"] =
    status;

  String message;

  serializeJson(
    doc,
    message
  );

  webSocket.sendTXT(
    message
  );

  Serial.print(
    "[STATUS] "
  );

  Serial.println(
    status
  );
}

// =====================================================
// SEND WATER EVENT
// =====================================================

void sendWaterEvent(
  const char* eventName
) {

  if (
    !wsConnected ||
    !robotRegistered
  ) {

    return;
  }

  JsonDocument doc;

  doc["type"] =
    "water:event";

  doc["robotId"] =
    ROBOT_ID;

  doc["event"] =
    eventName;

  doc["refillPump"] =
    refillPumpState;

  doc["sprayPump"] =
    sprayPumpState;

  // Ultrasonic fields disabled — send safe defaults
  doc["tankFull"] =
    false;

  doc["waterDistanceCm"] =
    -1;

  // float distance = getWaterDistance();  // disabled
  // doc["tankFull"]        = tankFull;    // disabled
  // doc["waterDistanceCm"] = distance;    // disabled

  String message;

  serializeJson(
    doc,
    message
  );

  webSocket.sendTXT(
    message
  );

  Serial.print(
    "[WATER EVENT SENT] "
  );

  Serial.println(
    eventName
  );
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

      Serial.print(
        "[WS IN] "
      );

      for (
        size_t i = 0;
        i < length;
        i++
      ) {

        Serial.print(
          (char)payload[i]
        );
      }

      Serial.println();

      {

        JsonDocument doc;

        DeserializationError error =
          deserializeJson(
            doc,
            payload,
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

  webSocket.begin(
    WS_HOST,
    WS_PORT,
    WS_PATH
  );

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

  // setupUltrasonic();  // disabled

  connectWiFi();

  setupWebSocket();
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  webSocket.loop();

  // checkWaterLevel();  // disabled — ultrasonic sensor not in use

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