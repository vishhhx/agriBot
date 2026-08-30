#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"


// =====================================================
// WIFI
// =====================================================

const char* WIFI_SSID =
    "Gangadhar";

const char* WIFI_PASSWORD =
    "gangu123";


// =====================================================
// WEBSOCKET SERVER
// =====================================================

const char* WS_HOST =
    "3.6.221.61";

const uint16_t WS_PORT =
    5000;

const char* WS_PATH =
    "/ws";


// =====================================================
// ROBOT
// =====================================================

const char* ROBOT_ID =
    "robot_prash_001";


// =====================================================
// ROBOT SECRET
// =====================================================

const char* ROBOT_SECRET =
    "a8jH2diBDteEx6AL-KiuFeGSBavxbhkaDszHaMrhkuQ";


// =====================================================
// WEBSOCKET
// =====================================================

WebSocketsClient webSocket;

bool wsConnected = false;
bool cameraRegistered = false;


// =====================================================
// CAMERA SETTINGS
// =====================================================

#define CAMERA_FRAME_SIZE FRAMESIZE_QVGA

// JPEG quality:
// lower number = better quality / larger frame
//
// 10 = high
// 12 = medium
// 15 = lower
//

#define CAMERA_JPEG_QUALITY 12


// =====================================================
// STREAM SETTINGS
// =====================================================

// Target FPS.
//
// Start with 10 FPS.
// Increase later if the network/server can handle it.
//

#define STREAM_FPS 10

const unsigned long FRAME_INTERVAL =
    1000 / STREAM_FPS;


unsigned long lastFrameTime =
    0;


// =====================================================
// AI THINKER ESP32-CAM
// OV2640 PIN CONFIGURATION
// =====================================================

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5

#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22


// =====================================================
// CAMERA INIT
// =====================================================

bool initCamera()
{
    Serial.println();
    Serial.println(
        "========================================"
    );

    Serial.println(
        "[CAMERA] Initializing..."
    );


    camera_config_t config;


    // =================================================
    // CAMERA CLOCK
    // =================================================

    config.ledc_channel =
        LEDC_CHANNEL_0;

    config.ledc_timer =
        LEDC_TIMER_0;


    // =================================================
    // DATA PINS
    // =================================================

    config.pin_d0 =
        Y2_GPIO_NUM;

    config.pin_d1 =
        Y3_GPIO_NUM;

    config.pin_d2 =
        Y4_GPIO_NUM;

    config.pin_d3 =
        Y5_GPIO_NUM;

    config.pin_d4 =
        Y6_GPIO_NUM;

    config.pin_d5 =
        Y7_GPIO_NUM;

    config.pin_d6 =
        Y8_GPIO_NUM;

    config.pin_d7 =
        Y9_GPIO_NUM;


    // =================================================
    // CONTROL PINS
    // =================================================

    config.pin_xclk =
        XCLK_GPIO_NUM;

    config.pin_pclk =
        PCLK_GPIO_NUM;

    config.pin_vsync =
        VSYNC_GPIO_NUM;

    config.pin_href =
        HREF_GPIO_NUM;

    config.pin_sccb_sda =
        SIOD_GPIO_NUM;

    config.pin_sccb_scl =
        SIOC_GPIO_NUM;

    config.pin_pwdn =
        PWDN_GPIO_NUM;

    config.pin_reset =
        RESET_GPIO_NUM;


    // =================================================
    // CAMERA CLOCK
    // =================================================

    config.xclk_freq_hz =
        20000000;


    // =================================================
    // JPEG
    // =================================================

    config.pixel_format =
        PIXFORMAT_JPEG;


    config.frame_size =
        CAMERA_FRAME_SIZE;


    config.jpeg_quality =
        CAMERA_JPEG_QUALITY;


    // =================================================
    // PSRAM
    // =================================================

    if (psramFound())
    {
        Serial.println(
            "[CAMERA] PSRAM detected"
        );

        config.fb_location =
            CAMERA_FB_IN_PSRAM;

        config.fb_count =
            2;

        config.grab_mode =
            CAMERA_GRAB_LATEST;
    }
    else
    {
        Serial.println(
            "[CAMERA] WARNING: PSRAM not found"
        );

        config.fb_location =
            CAMERA_FB_IN_DRAM;

        config.fb_count =
            1;

        config.grab_mode =
            CAMERA_GRAB_WHEN_EMPTY;
    }


    // =================================================
    // INITIALIZE
    // =================================================

    esp_err_t err =
        esp_camera_init(
            &config
        );


    if (err != ESP_OK)
    {
        Serial.print(
            "[CAMERA] Init failed: 0x"
        );

        Serial.println(
            err,
            HEX
        );

        return false;
    }


    // =================================================
    // SENSOR
    // =================================================

    sensor_t* sensor =
        esp_camera_sensor_get();


    if (!sensor)
    {
        Serial.println(
            "[CAMERA] Sensor not found"
        );

        return false;
    }


    // =================================================
    // SENSOR SETTINGS
    // =================================================

    sensor->set_framesize(
        sensor,
        CAMERA_FRAME_SIZE
    );


    sensor->set_quality(
        sensor,
        CAMERA_JPEG_QUALITY
    );


    // =================================================
    // OPTIONAL IMAGE CORRECTION
    // =================================================

    sensor->set_brightness(
        sensor,
        0
    );

    sensor->set_contrast(
        sensor,
        0
    );

    sensor->set_saturation(
        sensor,
        0
    );


    Serial.println(
        "[CAMERA] Initialized"
    );

    Serial.print(
        "[CAMERA] Frame size: QVGA"
    );

    Serial.println();

    Serial.print(
        "[CAMERA] JPEG quality: "
    );

    Serial.println(
        CAMERA_JPEG_QUALITY
    );


    Serial.println(
        "========================================"
    );


    return true;
}


// =====================================================
// WIFI
// =====================================================

void connectWiFi()
{
    Serial.println();
    Serial.println(
        "[WIFI] Connecting..."
    );


    WiFi.mode(
        WIFI_STA
    );


    WiFi.setSleep(
        false
    );


    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );


    int attempts = 0;


    while (
        WiFi.status() != WL_CONNECTED
    )
    {
        delay(500);

        Serial.print(
            "."
        );


        attempts++;


        if (attempts >= 60)
        {
            Serial.println();

            Serial.println(
                "[WIFI] Connection timeout"
            );

            return;
        }
    }


    Serial.println();

    Serial.println(
        "[WIFI] Connected"
    );


    Serial.print(
        "[WIFI] IP: "
    );

    Serial.println(
        WiFi.localIP()
    );


    Serial.print(
        "[WIFI] RSSI: "
    );

    Serial.print(
        WiFi.RSSI()
    );

    Serial.println(
        " dBm"
    );
}


// =====================================================
// REGISTER CAMERA
// =====================================================

void registerCamera()
{
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
        "CAMERA"
    );


    String message;


    serializeJson(
        doc,
        message
    );


    Serial.println();
    Serial.println(
        "[REGISTER OUT]"
    );

    Serial.println(
        message
    );


    webSocket.sendTXT(
        message
    );
}


// =====================================================
// SEND CAMERA FRAME
// =====================================================

bool sendCameraFrame()
{
    if (!wsConnected)
    {
        return false;
    }


    if (!cameraRegistered)
    {
        return false;
    }


    // =================================================
    // CAPTURE
    // =================================================

    camera_fb_t* fb =
        esp_camera_fb_get();


    if (!fb)
    {
        Serial.println(
            "[CAMERA] Capture failed"
        );

        return false;
    }


    // =================================================
    // CHECK FORMAT
    // =================================================

    if (
        fb->format !=
        PIXFORMAT_JPEG
    )
    {
        Serial.println(
            "[CAMERA] ERROR: Frame is not JPEG"
        );

        esp_camera_fb_return(
            fb
        );

        return false;
    }


    // =================================================
    // LOG
    // =================================================

    Serial.print(
        "[CAMERA OUT] JPEG "
    );

    Serial.print(
        fb->len / 1024
    );

    Serial.println(
        " KB"
    );


    // =================================================
    // SEND BINARY
    // =================================================

    bool sent =
        webSocket.sendBIN(
            fb->buf,
            fb->len
        );


    // =================================================
    // RELEASE FRAME
    // =================================================

    esp_camera_fb_return(
        fb
    );


    if (!sent)
    {
        Serial.println(
            "[CAMERA] Frame send FAILED"
        );

        return false;
    }


    return true;
}


// =====================================================
// WEBSOCKET EVENT
// =====================================================

void webSocketEvent(
    WStype_t type,
    uint8_t* payload,
    size_t length
)
{
    // =================================================
    // CONNECTED
    // =================================================

    if (
        type == WStype_CONNECTED
    )
    {
        Serial.println();
        Serial.println(
            "========================================"
        );

        Serial.println(
            "[WS] CONNECTED!"
        );


        Serial.print(
            "[WS] URL: ws://"
        );

        Serial.print(
            WS_HOST
        );

        Serial.print(
            ":"
        );

        Serial.print(
            WS_PORT
        );

        Serial.println(
            WS_PATH
        );


        wsConnected =
            true;


        cameraRegistered =
            false;


        registerCamera();


        Serial.println(
            "========================================"
        );


        return;
    }


    // =================================================
    // DISCONNECTED
    // =================================================

    if (
        type == WStype_DISCONNECTED
    )
    {
        Serial.println();

        Serial.println(
            "[WS] DISCONNECTED"
        );


        wsConnected =
            false;


        cameraRegistered =
            false;


        return;
    }


    // =================================================
    // TEXT
    // =================================================

    if (
        type == WStype_TEXT
    )
    {
        Serial.println();

        Serial.println(
            "[WS TEXT IN]"
        );


        if (
            payload != nullptr &&
            length > 0
        )
        {
            Serial.write(
                payload,
                length
            );
        }


        Serial.println();


        // =============================================
        // PARSE RESPONSE
        // =============================================

        JsonDocument doc;


        DeserializationError error =
            deserializeJson(
                doc,
                payload,
                length
            );


        if (error)
        {
            Serial.print(
                "[JSON ERROR] "
            );

            Serial.println(
                error.c_str()
            );

            return;
        }


        const char* messageType =
            doc["type"];


        if (!messageType)
        {
            return;
        }


        // =============================================
        // REGISTERED
        // =============================================

        if (
            strcmp(
                messageType,
                "robot:registered"
            ) == 0
        )
        {
            cameraRegistered =
                true;


            Serial.println();

            Serial.println(
                "========================================"
            );

            Serial.println(
                "[CAMERA] REGISTERED SUCCESSFULLY"
            );

            Serial.println(
                "[CAMERA] Streaming enabled"
            );

            Serial.println(
                "========================================"
            );


            // =========================================
            // NOTIFY SERVER: STREAM STARTING
            // (disabled — uncomment to enable)
            // =========================================

            // JsonDocument eventDoc;
            // eventDoc["type"]   = "camera:event";
            // eventDoc["robotId"] = ROBOT_ID;
            // eventDoc["role"]   = "CAMERA";
            // eventDoc["event"]  = "STREAM_STARTED";
            // String eventMessage;
            // serializeJson(eventDoc, eventMessage);
            // webSocket.sendTXT(eventMessage);
            // Serial.println("[CAMERA] Sent camera:event STREAM_STARTED");


            return;
        }


        // =============================================
        // AUTH SUCCESS
        // =============================================

        if (
            strcmp(
                messageType,
                "robot:register:success"
            ) == 0
        )
        {
            cameraRegistered =
                true;


            Serial.println(
                "[CAMERA] Registration successful"
            );


            return;
        }


        // =============================================
        // ERROR
        // =============================================

        if (
            strcmp(
                messageType,
                "ERROR"
            ) == 0
        )
        {
            Serial.println();

            Serial.println(
                "[SERVER ERROR]"
            );


            serializeJsonPretty(
                doc,
                Serial
            );


            Serial.println();


            return;
        }


        return;
    }


    // =================================================
    // BINARY
    // =================================================

    if (
        type == WStype_BIN
    )
    {
        Serial.print(
            "[WS BINARY IN] "
        );

        Serial.print(
            length
        );

        Serial.println(
            " bytes"
        );


        return;
    }


    // =================================================
    // PING
    // =================================================

    if (
        type == WStype_PING
    )
    {
        Serial.println(
            "[WS] PING"
        );

        return;
    }


    // =================================================
    // PONG
    // =================================================

    if (
        type == WStype_PONG
    )
    {
        Serial.println(
            "[WS] PONG"
        );

        return;
    }


    // =================================================
    // ERROR
    // =================================================

    if (
        type == WStype_ERROR
    )
    {
        Serial.println();

        Serial.println(
            "[WS] ERROR"
        );


        if (
            payload != nullptr &&
            length > 0
        )
        {
            Serial.print(
                "[WS ERROR] "
            );

            Serial.write(
                payload,
                length
            );

            Serial.println();
        }


        return;
    }
}


// =====================================================
// WEBSOCKET SETUP
// =====================================================

void setupWebSocket()
{
    Serial.println();

    Serial.println(
        "[WS] Initializing WS..."
    );


    Serial.print(
        "[WS] Host: "
    );

    Serial.println(
        WS_HOST
    );


    Serial.print(
        "[WS] Port: "
    );

    Serial.println(
        WS_PORT
    );


    Serial.print(
        "[WS] Path: "
    );

    Serial.println(
        WS_PATH
    );


    // =================================================
    // WS
    // =================================================

    webSocket.begin(
        WS_HOST,
        WS_PORT,
        WS_PATH
    );


    // =================================================
    // EVENT
    // =================================================

    webSocket.onEvent(
        webSocketEvent
    );


    // =================================================
    // RECONNECT
    // =================================================

    webSocket.setReconnectInterval(
        5000
    );


    // =================================================
    // HEARTBEAT
    // =================================================

    // Ping every 25s, pong timeout 10s, allow 3 missed pongs.

    webSocket.enableHeartbeat(
        25000,
        10000,
        3
    );


    Serial.println(
        "[WS] WS initialized"
    );
}


// =====================================================
// SETUP
// =====================================================

void setup()
{
    Serial.begin(
        115200
    );


    delay(1000);


    Serial.println();
    Serial.println();

    Serial.println(
        "=========================================="
    );

    Serial.println(
        "        ROBOT CAMERA MODULE"
    );

    Serial.println(
        "        ESP32-CAM"
    );

    Serial.println(
        "=========================================="
    );


    // =================================================
    // CAMERA
    // =================================================

    if (
        !initCamera()
    )
    {
        Serial.println(
            "[FATAL] Camera initialization failed"
        );

        while (true)
        {
            delay(1000);
        }
    }


    // =================================================
    // WIFI
    // =================================================

    connectWiFi();


    if (
        WiFi.status() != WL_CONNECTED
    )
    {
        Serial.println(
            "[FATAL] WiFi failed"
        );

        return;
    }


    // =================================================
    // WEBSOCKET
    // =================================================

    setupWebSocket();


    Serial.println();

    Serial.println(
        "[SYSTEM] Camera module ready"
    );
}


// =====================================================
// LOOP
// =====================================================

void loop()
{
    // =================================================
    // WEBSOCKET
    // =================================================

    webSocket.loop();


    // =================================================
    // WIFI RECOVERY
    // =================================================

    if (
        WiFi.status() != WL_CONNECTED
    )
    {
        static unsigned long lastWifiAttempt =
            0;


        if (
            millis() -
            lastWifiAttempt >
            5000
        )
        {
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


        return;
    }


    // =================================================
    // CAMERA STREAM  (disabled — uncomment to enable)
    // =================================================

    // if (
    //     wsConnected &&
    //     cameraRegistered
    // )
    // {
    //     unsigned long now = millis();
    //
    //     if ( now - lastFrameTime >= FRAME_INTERVAL )
    //     {
    //         lastFrameTime = now;
    //         sendCameraFrame();
    //     }
    // }


    delay(1);
}