package main

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type serverConfig struct {
	address     string
	origin      string
	localHTTP   bool
	behindProxy bool
}

func loadConfig() (serverConfig, error) {
	config := serverConfig{
		address:     env("LISTEN_ADDR", "127.0.0.1:8443"),
		localHTTP:   os.Getenv("LOCAL_HTTP") == "true",
		behindProxy: os.Getenv("BEHIND_PROXY") == "true",
	}

	if config.localHTTP && config.behindProxy {
		return config, fmt.Errorf("LOCAL_HTTP and BEHIND_PROXY cannot both be enabled")
	}

	scheme := "https"
	if config.localHTTP {
		scheme = "http"
		if !loopbackAddress(config.address) {
			return config, fmt.Errorf("LOCAL_HTTP requires a numeric loopback LISTEN_ADDR")
		}
	}

	config.origin = env("APP_ORIGIN", scheme+"://localhost:8443,"+scheme+"://localhost:5173,"+scheme+"://127.0.0.1:8443,"+scheme+"://127.0.0.1:5173")
	if config.behindProxy {
		port := env("PORT", "8443")
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return config, fmt.Errorf("PORT must be between 1 and 65535")
		}
		config.address = env("LISTEN_ADDR", net.JoinHostPort("::", port))
		config.origin = os.Getenv("APP_ORIGIN")
		if config.origin == "" && os.Getenv("RAILWAY_PUBLIC_DOMAIN") != "" {
			config.origin = "https://" + os.Getenv("RAILWAY_PUBLIC_DOMAIN")
		}
		if config.origin == "" {
			return config, fmt.Errorf("BEHIND_PROXY requires APP_ORIGIN or RAILWAY_PUBLIC_DOMAIN")
		}
		for _, origin := range strings.Split(config.origin, ",") {
			parsed, err := url.Parse(origin)
			if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" {
				return config, fmt.Errorf("BEHIND_PROXY requires exact HTTPS origins without paths in APP_ORIGIN")
			}
		}
	}
	return config, nil
}
