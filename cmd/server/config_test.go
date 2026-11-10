package main

import "testing"

func TestLoadConfig(testRunner *testing.T) {
	tests := []struct {
		name        string
		env         map[string]string
		address     string
		origin      string
		localHTTP   bool
		behindProxy bool
		wantError   bool
	}{
		{name: "local TLS", address: "127.0.0.1:8443"},
		{name: "local HTTP", env: map[string]string{"LOCAL_HTTP": "true"}, address: "127.0.0.1:8443", localHTTP: true},
		{name: "local HTTP public bind rejected", env: map[string]string{"LOCAL_HTTP": "true", "LISTEN_ADDR": ":8443"}, wantError: true},
		{name: "Railway", env: map[string]string{"BEHIND_PROXY": "true", "PORT": "8080", "RAILWAY_PUBLIC_DOMAIN": "quiz.up.railway.app"}, address: "[::]:8080", origin: "https://quiz.up.railway.app", behindProxy: true},
		{name: "custom domain and bind", env: map[string]string{"BEHIND_PROXY": "true", "APP_ORIGIN": "https://quiz.example.com,https://play.example.com", "LISTEN_ADDR": ":9000"}, address: ":9000", origin: "https://quiz.example.com,https://play.example.com", behindProxy: true},
		{name: "proxy default port", env: map[string]string{"BEHIND_PROXY": "true", "APP_ORIGIN": "https://quiz.example.com"}, address: "[::]:8443", origin: "https://quiz.example.com", behindProxy: true},
		{name: "missing public origin", env: map[string]string{"BEHIND_PROXY": "true"}, wantError: true},
		{name: "insecure origin", env: map[string]string{"BEHIND_PROXY": "true", "APP_ORIGIN": "http://quiz.example.com"}, wantError: true},
		{name: "origin path", env: map[string]string{"BEHIND_PROXY": "true", "APP_ORIGIN": "https://quiz.example.com/"}, wantError: true},
		{name: "origin credentials", env: map[string]string{"BEHIND_PROXY": "true", "APP_ORIGIN": "https://user@quiz.example.com"}, wantError: true},
		{name: "origin query", env: map[string]string{"BEHIND_PROXY": "true", "APP_ORIGIN": "https://quiz.example.com?test=true"}, wantError: true},
		{name: "invalid port", env: map[string]string{"BEHIND_PROXY": "true", "PORT": "invalid"}, wantError: true},
		{name: "zero port", env: map[string]string{"BEHIND_PROXY": "true", "PORT": "0"}, wantError: true},
		{name: "out of range port", env: map[string]string{"BEHIND_PROXY": "true", "PORT": "65536"}, wantError: true},
		{name: "conflicting modes", env: map[string]string{"BEHIND_PROXY": "true", "LOCAL_HTTP": "true"}, wantError: true},
	}
	for _, test := range tests {
		testRunner.Run(test.name, func(testRunner *testing.T) {
			for _, key := range []string{"LOCAL_HTTP", "BEHIND_PROXY", "LISTEN_ADDR", "PORT", "APP_ORIGIN", "RAILWAY_PUBLIC_DOMAIN"} {
				testRunner.Setenv(key, "")
			}
			for key, value := range test.env {
				testRunner.Setenv(key, value)
			}
			config, err := loadConfig()
			if (err != nil) != test.wantError {
				testRunner.Fatalf("loadConfig() error = %v, wantError %v", err, test.wantError)
			}
			if test.wantError {
				return
			}
			if config.address != test.address || config.localHTTP != test.localHTTP || config.behindProxy != test.behindProxy {
				testRunner.Fatalf("unexpected config: %+v", config)
			}
			if test.origin != "" && config.origin != test.origin {
				testRunner.Fatalf("origin = %q, want %q", config.origin, test.origin)
			}
		})
	}
}
