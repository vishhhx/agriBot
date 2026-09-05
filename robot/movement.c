#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// WIFI
// =====================================================

const char* WIFI_SSID = "Gangadhar";
const char* WIFI_PASSWORD = "gangu123";


// =====================================================
// WEBSOCKET SERVER
// =====================================================

const char* WS_HOST =
    "rf3pnggh-5000.inc1.devtunnels.ms";

const uint16_t WS_PORT = 443;

const char* WS_PATH = "/ws";


// =====================================================
// ROBOT
// =====================================================

const char* ROBOT_ID =
    "robot_prash_001";

const char* ROBOT_SECRET =
    "skhtpAftcrkL-ujQK_9-Hxxo9dpeauBuHuSBcQmcQzI";


// =====================================================
// WEBSOCKET
// =====================================================

WebSocketsClient webSocket;


// =====================================================
// LEFT BTS7960 - ESP32 38-pin
// =====================================================

#define LEFT_RPWM 25
#define LEFT_LPWM 26
#define LEFT_REN  27
#define LEFT_LEN  14


// =====================================================
// RIGHT BTS7960 - ESP32 38-pin
// =====================================================

#define RIGHT_RPWM 32
#define RIGHT_LPWM 33
#define RIGHT_REN  13
#define RIGHT_LEN  12


// =====================================================
// MOTOR PWM
// =====================================================

#define MOTOR_SPEED 200

#define PWM_FREQUENCY 20000
#define PWM_RESOLUTION 8


// =====================================================
// HORN
// Change this pin if GPIO 13 is already used
// =====================================================

#define HORN_PIN 23

bool hornState = false;


// =====================================================
// OLED I2C
// =====================================================

// ESP32 38-pin DevKit/WROOM I2C pins
#define OLED_SDA 21
#define OLED_SCL 22

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_RESET -1


// =====================================================
// OLED ADDRESSES
// =====================================================

#define LEFT_OLED_ADDRESS  0x3C
#define RIGHT_OLED_ADDRESS 0x3D


Adafruit_SSD1306 leftEye(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    OLED_RESET
);

Adafruit_SSD1306 rightEye(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    OLED_RESET
);

bool oledReady = false;


// =====================================================
// EYE STATE
// =====================================================

int eyeX = 0;
int eyeY = 0;

bool eyesOpen = true;

bool autoEyes = true;

unsigned long lastEyeMovement = 0;
unsigned long lastBlink = 0;

unsigned long nextEyeMoveInterval = 2500;
unsigned long nextBlinkInterval = 4000;


// =====================================================
// TELEMETRY
// =====================================================

unsigned long lastTelemetry = 0;

const unsigned long TELEMETRY_INTERVAL = 1000;


// =====================================================
// STATUS
// =====================================================

bool websocketConnected = false;

bool robotRegistered = false;


// =====================================================
// CURRENT MOTOR STATE
// =====================================================

String currentCommand = "stop";


// =====================================================
// FUNCTION DECLARATIONS
// =====================================================

void connectWiFi();

void setupMotors();

void setupHorn();

void setupEyes();

void setupWebSocket();

void stopRobot();

void forward(int speedInput = 0);

void backward(int speedInput = 0);

void left(int speedInput = 0);

void right(int speedInput = 0);

void hornOn();

void hornOff();

void hornBeep(int duration);

void drawSingleEye(
    Adafruit_SSD1306 &display,
    int pupilOffsetX,
    int pupilOffsetY,
    bool open
);

void drawEyes();

void eyesCenter();

void eyesLookLeft();

void eyesLookRight();

void eyesLookUp();

void eyesLookDown();

void blinkEyes();

void updateEyes();

void sendRegistration();

void sendStatus(const char* status);

void sendTelemetry();

void handleCommand(JsonDocument& doc);

void webSocketEvent(
    WStype_t type,
    uint8_t* payload,
    size_t length
);


// =====================================================
// MOTOR SPEED
// =====================================================

int getPwmSpeed(int speedInput) {

    if (speedInput <= 0) {
        return MOTOR_SPEED;
    }

    return map(
        constrain(speedInput, 1, 100),
        1,
        100,
        80,
        255
    );
}


// =====================================================
// STOP ROBOT
// =====================================================

void stopRobot() {

    ledcWrite(LEFT_RPWM, 0);
    ledcWrite(LEFT_LPWM, 0);

    ledcWrite(RIGHT_RPWM, 0);
    ledcWrite(RIGHT_LPWM, 0);

    currentCommand = "stop";

    Serial.println("[MOTOR] STOP");
}


// =====================================================
// FORWARD
// =====================================================

void forward(int speedInput) {

    int pwm = getPwmSpeed(speedInput);

    ledcWrite(LEFT_RPWM, pwm);
    ledcWrite(LEFT_LPWM, 0);

    ledcWrite(RIGHT_RPWM, pwm);
    ledcWrite(RIGHT_LPWM, 0);

    currentCommand = "forward";

    Serial.print("[MOTOR] FORWARD PWM: ");
    Serial.println(pwm);
}


// =====================================================
// BACKWARD
// =====================================================

void backward(int speedInput) {

    int pwm = getPwmSpeed(speedInput);

    ledcWrite(LEFT_RPWM, 0);
    ledcWrite(LEFT_LPWM, pwm);

    ledcWrite(RIGHT_RPWM, 0);
    ledcWrite(RIGHT_LPWM, pwm);

    currentCommand = "backward";

    Serial.print("[MOTOR] BACKWARD PWM: ");
    Serial.println(pwm);
}


// =====================================================
// LEFT
// =====================================================

void left(int speedInput) {

    int pwm = getPwmSpeed(speedInput);

    ledcWrite(LEFT_RPWM, 0);
    ledcWrite(LEFT_LPWM, pwm);

    ledcWrite(RIGHT_RPWM, pwm);
    ledcWrite(RIGHT_LPWM, 0);

    currentCommand = "left";

    Serial.print("[MOTOR] LEFT PWM: ");
    Serial.println(pwm);
}


// =====================================================
// RIGHT
// =====================================================

void right(int speedInput) {

    int pwm = getPwmSpeed(speedInput);

    ledcWrite(LEFT_RPWM, pwm);
    ledcWrite(LEFT_LPWM, 0);

    ledcWrite(RIGHT_RPWM, 0);
    ledcWrite(RIGHT_LPWM, pwm);

    currentCommand = "right";

    Serial.print("[MOTOR] RIGHT PWM: ");
    Serial.println(pwm);
}


// =====================================================
// MOTOR SETUP
// =====================================================

void setupMotors() {

    Serial.println("[MOTOR] Setting up BTS7960...");

    pinMode(LEFT_REN, OUTPUT);
    pinMode(LEFT_LEN, OUTPUT);

    pinMode(RIGHT_REN, OUTPUT);
    pinMode(RIGHT_LEN, OUTPUT);


    digitalWrite(LEFT_REN, HIGH);
    digitalWrite(LEFT_LEN, HIGH);

    digitalWrite(RIGHT_REN, HIGH);
    digitalWrite(RIGHT_LEN, HIGH);


    ledcAttach(
        LEFT_RPWM,
        PWM_FREQUENCY,
        PWM_RESOLUTION
    );

    ledcAttach(
        LEFT_LPWM,
        PWM_FREQUENCY,
        PWM_RESOLUTION
    );

    ledcAttach(
        RIGHT_RPWM,
        PWM_FREQUENCY,
        PWM_RESOLUTION
    );

    ledcAttach(
        RIGHT_LPWM,
        PWM_FREQUENCY,
        PWM_RESOLUTION
    );


    stopRobot();

    Serial.println("[MOTOR] BTS7960 READY");
}


// =====================================================
// HORN SETUP
// =====================================================

void setupHorn() {

    pinMode(HORN_PIN, OUTPUT);

    noTone(HORN_PIN);

    hornState = false;

    Serial.println("[HORN] READY");
}


// =====================================================
// HORN ON
// =====================================================

void hornOn() {

    tone(HORN_PIN, 1000);

    hornState = true;

    Serial.println("[HORN] ON");
}


// =====================================================
// HORN OFF
// =====================================================

void hornOff() {

    noTone(HORN_PIN);

    hornState = false;

    Serial.println("[HORN] OFF");
}


// =====================================================
// HORN BEEP
// =====================================================

void hornBeep(int duration) {

    hornOn();

    delay(duration);

    hornOff();
}


// =====================================================
// DRAW SINGLE EYE
// =====================================================

void drawSingleEye(
    Adafruit_SSD1306 &display,
    int pupilOffsetX,
    int pupilOffsetY,
    bool open
) {

    display.clearDisplay();


    // ---------------------------------------------
    // CLOSED EYE
    // ---------------------------------------------

    if (!open) {

        display.drawLine(
            20,
            32,
            108,
            32,
            SSD1306_WHITE
        );

        display.drawLine(
            25,
            33,
            103,
            33,
            SSD1306_WHITE
        );

        display.display();

        return;
    }


    // ---------------------------------------------
    // WHITE EYE
    // ---------------------------------------------

    display.fillRoundRect(
        12,
        6,
        104,
        52,
        22,
        SSD1306_WHITE
    );


    // ---------------------------------------------
    // BLACK INNER AREA
    // ---------------------------------------------

    display.fillRoundRect(
        17,
        10,
        94,
        44,
        18,
        SSD1306_BLACK
    );


    // ---------------------------------------------
    // PUPIL
    // ---------------------------------------------

    int pupilX =
        constrain(
            64 + pupilOffsetX,
            35,
            93
        );

    int pupilY =
        constrain(
            32 + pupilOffsetY,
            20,
            44
        );


    display.fillCircle(
        pupilX,
        pupilY,
        17,
        SSD1306_WHITE
    );


    // Pupil center

    display.fillCircle(
        pupilX,
        pupilY,
        9,
        SSD1306_BLACK
    );


    display.display();
}


// =====================================================
// DRAW BOTH EYES
// =====================================================

void drawEyes() {

    if (!oledReady) {
        return;
    }

    drawSingleEye(
        leftEye,
        eyeX,
        eyeY,
        eyesOpen
    );

    drawSingleEye(
        rightEye,
        eyeX,
        eyeY,
        eyesOpen
    );
}


// =====================================================
// EYES CENTER
// =====================================================

void eyesCenter() {

    eyeX = 0;
    eyeY = 0;

    eyesOpen = true;

    drawEyes();

    Serial.println("[EYES] CENTER");
}


// =====================================================
// EYES LEFT
// =====================================================

void eyesLookLeft() {

    eyeX = -22;
    eyeY = 0;

    eyesOpen = true;

    drawEyes();

    Serial.println("[EYES] LEFT");
}


// =====================================================
// EYES RIGHT
// =====================================================

void eyesLookRight() {

    eyeX = 22;
    eyeY = 0;

    eyesOpen = true;

    drawEyes();

    Serial.println("[EYES] RIGHT");
}


// =====================================================
// EYES UP
// =====================================================

void eyesLookUp() {

    eyeX = 0;
    eyeY = -10;

    eyesOpen = true;

    drawEyes();

    Serial.println("[EYES] UP");
}


// =====================================================
// EYES DOWN
// =====================================================

void eyesLookDown() {

    eyeX = 0;
    eyeY = 10;

    eyesOpen = true;

    drawEyes();

    Serial.println("[EYES] DOWN");
}


// =====================================================
// BLINK EYES
// =====================================================

void blinkEyes() {

    if (!oledReady) {
        return;
    }

    eyesOpen = false;

    drawEyes();

    delay(120);

    eyesOpen = true;

    drawEyes();

    Serial.println("[EYES] BLINK");
}


// =====================================================
// AUTO EYE MOVEMENT
// =====================================================

void updateEyes() {

    if (!oledReady) {
        return;
    }


    // ---------------------------------------------
    // AUTO BLINK
    // ---------------------------------------------

    if (
        millis() - lastBlink >=
        nextBlinkInterval
    ) {

        lastBlink = millis();

        nextBlinkInterval =
            random(2500, 6000);

        blinkEyes();
    }


    // ---------------------------------------------
    // AUTO MOVEMENT
    // ---------------------------------------------

    if (!autoEyes) {
        return;
    }

    if (
        millis() - lastEyeMovement >=
        nextEyeMoveInterval
    ) {

        lastEyeMovement = millis();

        nextEyeMoveInterval =
            random(1500, 4000);


        int movement =
            random(0, 5);


        switch (movement) {

            case 0:
                eyesCenter();
                break;

            case 1:
                eyesLookLeft();
                break;

            case 2:
                eyesLookRight();
                break;

            case 3:
                eyesLookUp();
                break;

            case 4:
                eyesLookDown();
                break;
        }
    }
}


// =====================================================
// OLED SETUP
// =====================================================

void setupEyes() {

    Serial.println("[EYES] Initializing OLEDs...");


    Wire.begin(
        OLED_SDA,
        OLED_SCL
    );


    // LEFT OLED

    bool leftOk =
        leftEye.begin(
            SSD1306_SWITCHCAPVCC,
            LEFT_OLED_ADDRESS
        );


    // RIGHT OLED

    bool rightOk =
        rightEye.begin(
            SSD1306_SWITCHCAPVCC,
            RIGHT_OLED_ADDRESS
        );


    if (!leftOk) {

        Serial.println(
            "[EYES] LEFT OLED NOT FOUND"
        );
    }


    if (!rightOk) {

        Serial.println(
            "[EYES] RIGHT OLED NOT FOUND"
        );
    }


    if (!leftOk || !rightOk) {

        oledReady = false;

        Serial.println(
            "[EYES] OLED SYSTEM DISABLED"
        );

        return;
    }


    oledReady = true;


    randomSeed(
        esp_random()
    );


    eyesCenter();


    Serial.println(
        "[EYES] BOTH OLEDs READY"
    );
}


// =====================================================
// SEND ROBOT REGISTRATION
// =====================================================

void sendRegistration() {

    if (!websocketConnected) {
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
        doc["roles"].to<JsonArray>();

    roles.add(
        "MOVEMENT_AND_OTHER"
    );


    String registration;

    serializeJson(
        doc,
        registration
    );


    Serial.println(
        "[ROBOT] Sending registration..."
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
        !websocketConnected ||
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
        "MOVEMENT_AND_OTHER";

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
// SEND TELEMETRY
// =====================================================

void sendTelemetry() {

    if (
        !websocketConnected ||
        !robotRegistered
    ) {
        return;
    }


    JsonDocument doc;

    doc["type"] =
        "robot:telemetry";

    doc["robotId"] =
        ROBOT_ID;

    doc["role"] =
        "MOVEMENT_AND_OTHER";


    JsonObject payload =
        doc["payload"].to<JsonObject>();


    // Original telemetry

    payload["battery"] = 100;


    if (
        currentCommand == "stop"
    ) {
        payload["speed"] = 0;
    }
    else {

        payload["speed"] = 10;
    }


    payload["temperature"] = 30.0;


    // Additional telemetry

    payload["horn"] =
        hornState;

    payload["eyes"] =
        oledReady;

    payload["eyeX"] =
        eyeX;

    payload["eyeY"] =
        eyeY;

    payload["autoEyes"] =
        autoEyes;

    payload["currentCommand"] =
        currentCommand;


    String telemetry;

    serializeJson(
        doc,
        telemetry
    );


    webSocket.sendTXT(
        telemetry
    );


    Serial.println(
        "[TELEMETRY] Sent"
    );
}


// =====================================================
// HANDLE COMMAND
// =====================================================

void handleCommand(
    JsonDocument& doc
) {

    const char* command =
        doc["data"]["command"] | "";

    const int speed =
        doc["data"]["speed"] | 0;

    const char* requestId =
        doc["data"]["requestId"] | "";


    Serial.println();
    Serial.println(
        "=============================="
    );

    Serial.println(
        "[COMMAND RECEIVED]"
    );

    Serial.print(
        "Command: "
    );

    Serial.println(
        command
    );

    Serial.print(
        "Speed: "
    );

    Serial.println(
        speed
    );

    Serial.print(
        "Request ID: "
    );

    Serial.println(
        requestId
    );

    Serial.println(
        "=============================="
    );


    // =================================================
    // MOVEMENT COMMANDS
    // =================================================

    if (
        strcmp(
            command,
            "forward"
        ) == 0
    ) {

        forward(speed);
    }


    else if (
        strcmp(
            command,
            "backward"
        ) == 0
    ) {

        backward(speed);
    }


    else if (
        strcmp(
            command,
            "left"
        ) == 0
    ) {

        left(speed);
    }


    else if (
        strcmp(
            command,
            "right"
        ) == 0
    ) {

        right(speed);
    }


    else if (
        strcmp(
            command,
            "stop"
        ) == 0
    ) {

        stopRobot();
    }


    // =================================================
    // HORN COMMANDS
    // =================================================

    else if (
        strcmp(
            command,
            "horn_on"
        ) == 0
    ) {

        hornOn();
    }


    else if (
        strcmp(
            command,
            "horn_off"
        ) == 0
    ) {

        hornOff();
    }


    else if (
        strcmp(
            command,
            "horn"
        ) == 0
    ) {

        int duration =
            doc["data"]["duration"] | 300;

        duration =
            constrain(
                duration,
                50,
                3000
            );

        hornBeep(
            duration
        );
    }


    // =================================================
    // EYE COMMANDS
    // =================================================

    else if (
        strcmp(
            command,
            "eyes_center"
        ) == 0
    ) {

        autoEyes = false;

        eyesCenter();
    }


    else if (
        strcmp(
            command,
            "eyes_left"
        ) == 0
    ) {

        autoEyes = false;

        eyesLookLeft();
    }


    else if (
        strcmp(
            command,
            "eyes_right"
        ) == 0
    ) {

        autoEyes = false;

        eyesLookRight();
    }


    else if (
        strcmp(
            command,
            "eyes_up"
        ) == 0
    ) {

        autoEyes = false;

        eyesLookUp();
    }


    else if (
        strcmp(
            command,
            "eyes_down"
        ) == 0
    ) {

        autoEyes = false;

        eyesLookDown();
    }


    else if (
        strcmp(
            command,
            "eyes_blink"
        ) == 0
    ) {

        autoEyes = false;

        blinkEyes();
    }


    else if (
        strcmp(
            command,
            "eyes_auto"
        ) == 0
    ) {

        autoEyes = true;

        Serial.println(
            "[EYES] AUTO MODE ON"
        );
    }


    else if (
        strcmp(
            command,
            "eyes_manual"
        ) == 0
    ) {

        autoEyes = false;

        Serial.println(
            "[EYES] MANUAL MODE"
        );
    }


    // =================================================
    // UNKNOWN
    // =================================================

    else {

        Serial.print(
            "[COMMAND] Unknown: "
        );

        Serial.println(
            command
        );

        // Preserve original safety behavior

        stopRobot();
    }
}


// =====================================================
// WEBSOCKET EVENT
// =====================================================

void webSocketEvent(
    WStype_t type,
    uint8_t* payload,
    size_t length
) {

    switch (type) {


        // =============================================
        // CONNECTED
        // =============================================

        case WStype_CONNECTED:

            Serial.println();
            Serial.println(
                "======================================"
            );

            Serial.println(
                "[WS] WS CONNECTED"
            );

            Serial.println(
                "======================================"
            );


            websocketConnected = true;

            robotRegistered = false;


            sendRegistration();

            break;


        // =============================================
        // DISCONNECTED
        // =============================================

        case WStype_DISCONNECTED:

            Serial.println(
                "[WS] WS DISCONNECTED"
            );


            websocketConnected = false;

            robotRegistered = false;


            // SAFETY STOP

            stopRobot();

            hornOff();

            break;


        // =============================================
        // TEXT
        // =============================================

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


                const char* messageType =
                    doc["type"] | "";


                // -----------------------------------------
                // ROBOT REGISTERED
                // -----------------------------------------

                if (
                    strcmp(
                        messageType,
                        "robot:registered"
                    ) == 0
                ) {

                    const char* robotId =
                        doc["robotId"] | "";


                    robotRegistered = true;


                    Serial.println(
                        "[ROBOT] REGISTERED SUCCESSFULLY"
                    );

                    Serial.print(
                        "Robot ID: "
                    );

                    Serial.println(
                        robotId
                    );


                    Serial.println(
                        "Role: MOVEMENT_AND_OTHER"
                    );


                    sendStatus(
                        "online"
                    );
                }


                // -----------------------------------------
                // COMMAND
                // -----------------------------------------

                else if (
                    strcmp(
                        messageType,
                        "COMMAND"
                    ) == 0
                ) {

                    handleCommand(
                        doc
                    );
                }


                // -----------------------------------------
                // ERROR
                // -----------------------------------------

                else if (
                    strcmp(
                        messageType,
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


                    if (
                        !robotRegistered
                    ) {

                        stopRobot();

                        hornOff();
                    }
                }


                // -----------------------------------------
                // UNKNOWN EVENT
                // -----------------------------------------

                else {

                    Serial.print(
                        "[WS] Unknown event: "
                    );

                    Serial.println(
                        messageType
                    );
                }
            }

            break;


        // =============================================
        // ERROR
        // =============================================

        case WStype_ERROR:

            Serial.println(
                "[WS] WebSocket ERROR"
            );


            websocketConnected = false;

            robotRegistered = false;


            stopRobot();

            hornOff();

            break;


        default:

            break;
    }
}


// =====================================================
// WIFI
// =====================================================

void connectWiFi() {

    Serial.println(
        "[WIFI] Connecting..."
    );


    WiFi.mode(
        WIFI_STA
    );


    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );


    while (
        WiFi.status() !=
        WL_CONNECTED
    ) {

        delay(500);

        Serial.print(".");
    }


    Serial.println();

    Serial.println(
        "======================================"
    );

    Serial.println(
        "[WIFI] CONNECTED"
    );

    Serial.println(
        "======================================"
    );


    Serial.print(
        "IP: "
    );

    Serial.println(
        WiFi.localIP()
    );


    Serial.print(
        "RSSI: "
    );

    Serial.print(
        WiFi.RSSI()
    );

    Serial.println(
        " dBm"
    );
}


// =====================================================
// WEBSOCKET SETUP
// =====================================================

void setupWebSocket() {

    Serial.println(
        "[WS] Starting WS..."
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
        5000
    );


    webSocket.enableHeartbeat(
        25000,
        10000,
        3
    );


    Serial.println(
        "[WS] WS client started"
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
        "======================================"
    );

    Serial.println(
        " AGRIBOT ESP32 + EYES + HORN"
    );

    Serial.println(
        "======================================"
    );


    // MOTOR

    setupMotors();


    // HORN

    setupHorn();


    // EYES

    setupEyes();


    // WIFI

    connectWiFi();


    // WEBSOCKET

    setupWebSocket();
}


// =====================================================
// LOOP
// =====================================================

void loop() {


    // ---------------------------------------------
    // WEBSOCKET
    // ---------------------------------------------

    webSocket.loop();


    // ---------------------------------------------
    // EYE ANIMATION
    // ---------------------------------------------

    updateEyes();


    // ---------------------------------------------
    // WIFI CHECK
    // ---------------------------------------------

    if (
        WiFi.status() !=
        WL_CONNECTED
    ) {

        Serial.println(
            "[WIFI] Disconnected"
        );


        // SAFETY STOP

        stopRobot();

        hornOff();


        websocketConnected = false;

        robotRegistered = false;


        delay(1000);


        connectWiFi();

        return;
    }


    // ---------------------------------------------
    // TELEMETRY
    // ---------------------------------------------

    if (
        robotRegistered &&
        millis() - lastTelemetry >=
        TELEMETRY_INTERVAL
    ) {

        lastTelemetry =
            millis();


        sendTelemetry();
    }
}