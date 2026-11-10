package transport

import (
    "net/http/httptest"
    "os"
    "path/filepath"
    "strings"
    "testing"
)

func TestRouterAPIFallbackAndStaticRoutes(t *testing.T) {
    static := t.TempDir()

    for name, body := range map[string]string{
        "index.html": "<main>Quiz</main>",
        "app.js":     "// quiz asset",
    } {
        if err := os.WriteFile(filepath.Join(static, name), []byte(body), 0600); err != nil {
            t.Fatal(err)
        }
    }

    // These routes must work without accessing guest sessions or storage.
    handler := New(nil, "https://quiz.test", static).Handler()

    for _, tc := range []struct {
        name, method, path, origin string
        status                     int
        body                       string
    }{

        {
            "catalog",
            "GET",
            "/api/catalog",
            "",
            200,
            `"categories"`,
        },

        {
            "head catalog",
            "HEAD",
            "/api/catalog",
            "https://quiz.test",
            200,
            "",
        },

        {
            "unknown API",
            "GET",
            "/api/missing",
            "",
            404,
            `"error":"Endpoint not found"`,
        },

        {
            "API wrong method",
            "POST",
            "/api/catalog",
            "https://quiz.test",
            404,
            `"error":"Endpoint not found"`,
        },

        {
            "mutation origin",
            "POST",
            "/api/session",
            "https://evil.test",
            403,
            "Request origin is not allowed",
        },

        {
            "homepage",
            "GET",
            "/",
            "",
            200,
            "<main>Quiz</main>",
        },

        {
            "SPA deep link",
            "GET",
            "/rooms/ABC123",
            "",
            200,
            "<main>Quiz</main>",
        },

        {
            "room invite deep link",
            "GET",
            "/join/ABC123",
            "",
            200,
            "<main>Quiz</main>",
        },

        {
            "static asset",
            "GET",
            "/app.js",
            "",
            200,
            "// quiz asset",
        },

        {
            "missing asset",
            "GET",
            "/missing.js",
            "",
            404,
            "404 page not found",
        },

        {
            "static wrong method",
            "POST",
            "/",
            "https://quiz.test",
            405,
            "Method not allowed",
        },
    } {
        t.Run(tc.name, func(t *testing.T) {
            req := httptest.NewRequest(tc.method, tc.path, nil)

            if tc.origin != "" {
                req.Header.Set("Origin", tc.origin)
            }

            recorder := httptest.NewRecorder()
            handler.ServeHTTP(recorder, req)

            if recorder.Code != tc.status || !strings.Contains(recorder.Body.String(), tc.body) {
                t.Fatalf("status=%d body=%q; want status=%d containing %q", recorder.Code, recorder.Body.String(), tc.status, tc.body)
            }

            if recorder.Header().Get("Cache-Control") != "no-store" || recorder.Header().Get("X-Content-Type-Options") != "nosniff" {
                t.Fatal("route bypassed security headers")
            }
        })
    }
}
