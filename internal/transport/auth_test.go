package transport

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"quiz/internal/accounts"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

func TestAccountAuthenticationAndTeacherPermissions(t *testing.T) {
	store := integrationStore(t)
	app := New(store, "", "")
	server := httptest.NewTLSServer(app.Handler())
	defer server.Close()
	app.Origins = []string{server.URL}
	client := server.Client()
	client.Jar, _ = cookiejar.New(nil)
	post := func(client *http.Client, path string, body string, expected int) (*http.Response, []byte) {
		t.Helper()
		request, _ := http.NewRequest("POST", server.URL+path, strings.NewReader(body))
		request.Header.Set("Origin", server.URL)
		request.Header.Set("Content-Type", "application/json")
		response, err := client.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(response.Body)
		response.Body.Close()
		if response.StatusCode != expected {
			t.Fatalf("%s: expected %d, got %d: %s", path, expected, response.StatusCode, data)
		}
		return response, data
	}
	setup := `{"source":"preset","categories":["Science"],"count":5,"timer":10,"participate":true,"name":"Teacher","avatar":"memoji-1"}`
	post(client, "/api/rooms", setup, 401)
	post(client, "/api/auth/signup", `{"name":"Teacher","email":"teacher@example.com","password":"short","role":"teacher"}`, 400)
	post(client, "/api/auth/signup", `{"name":"Teacher","email":"teacher@example.com","password":"a secure passphrase 2026","role":"admin"}`, 400)
	response, data := post(client, "/api/auth/signup", `{"name":"Teacher","email":" Teacher@Example.com ","password":"a secure passphrase 2026","role":"teacher"}`, 201)
	var firstCookie *http.Cookie
	for _, cookie := range response.Cookies() {
		if cookie.Name == accounts.CookieName && cookie.Value != "" {
			firstCookie = cookie
		}
	}
	if firstCookie == nil || !firstCookie.Secure || !firstCookie.HttpOnly || firstCookie.SameSite != http.SameSiteLaxMode || firstCookie.Path != "/" {
		t.Fatal("unsafe account cookie")
	}
	if strings.Contains(string(data), "password") || strings.Contains(string(data), firstCookie.Value) || !strings.Contains(string(data), `"role":"teacher"`) {
		t.Fatal("unsafe account response", string(data))
	}
	var stored string
	if err := store.DB.QueryRow(context.Background(), "SELECT password_hash FROM accounts WHERE email='teacher@example.com'").Scan(&stored); err != nil || !accounts.CheckPassword("a secure passphrase 2026", stored) {
		t.Fatal("password not hashed", err)
	}
	post(client, "/api/auth/signup", `{"name":"Other","email":"TEACHER@example.com","password":"a secure passphrase 2026","role":"student"}`, 409)
	_, data = post(client, "/api/rooms", setup, 201)
	var created struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(data, &created); err != nil || created.Code == "" {
		t.Fatal("teacher room missing", string(data))
	}
	post(client, "/api/auth/login", `{"email":"teacher@example.com","password":"incorrect password"}`, 401)
	post(client, "/api/auth/logout", `{}`, 200)
	replay, _ := http.NewRequest("POST", server.URL+"/api/rooms", strings.NewReader(setup))
	replay.Header.Set("Origin", server.URL)
	replay.AddCookie(firstCookie)
	revoked, err := client.Do(replay)
	if err != nil {
		t.Fatal(err)
	}
	revoked.Body.Close()
	if revoked.StatusCode != 401 {
		t.Fatal("revoked account token still accepted")
	}
	post(client, "/api/auth/login", `{"email":"TEACHER@example.com","password":"a secure passphrase 2026"}`, 200)
	restored, err := client.Get(server.URL + "/api/rooms/" + created.Code)
	if err != nil {
		t.Fatal(err)
	}
	restoredBody, _ := io.ReadAll(restored.Body)
	restored.Body.Close()
	if restored.StatusCode != 200 || !strings.Contains(string(restoredBody), `"isHost":true`) {
		t.Fatal("account did not retain its room", string(restoredBody))
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	connection, _, err := websocket.Dial(ctx, strings.Replace(server.URL, "https:", "wss:", 1)+"/api/rooms/"+created.Code+"/ws?mode=claim", &websocket.DialOptions{HTTPClient: client, HTTPHeader: http.Header{"Origin": []string{server.URL}}})
	if err != nil {
		t.Fatal(err)
	}
	defer connection.CloseNow()
	for range 2 {
		var event Event
		if err := wsjson.Read(ctx, connection, &event); err != nil {
			t.Fatal(err)
		}
	}
	stopSignals := make(chan struct{})
	defer close(stopSignals)
	go func() {
		tick := time.NewTicker(30 * time.Millisecond)
		defer tick.Stop()
		for {
			select {
			case <-stopSignals:
				return
			case <-tick.C:
				app.signal(created.Code)
			}
		}
	}()
	post(client, "/api/auth/logout", `{}`, 200)
	for {
		var event Event
		err := wsjson.Read(ctx, connection, &event)
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
				t.Fatal("logout did not revoke the active account connection", err)
			}
			break
		}
	}
	student := server.Client()
	student.Jar, _ = cookiejar.New(nil)
	post(student, "/api/auth/signup", `{"name":"Student","email":"student@example.com","password":"another safe passphrase","role":"student"}`, 201)
	post(student, "/api/rooms", setup, 403)
	_, data = post(student, "/api/auth/login", `{"email":"student@example.com","password":"another safe passphrase","role":"teacher"}`, 200)
	if !strings.Contains(string(data), `"role":"student"`) {
		t.Fatal("role escalation during login")
	}
	post(student, "/api/rooms/"+created.Code+"/join", `{"name":"Student","avatar":"memoji-2"}`, 200)
	guest := server.Client()
	guest.Jar, _ = cookiejar.New(nil)
	post(guest, "/api/session", `{}`, 200)
	post(guest, "/api/rooms/"+created.Code+"/join", `{"name":"Guest","avatar":"memoji-3"}`, 200)
	for attempt := 0; attempt < 10; attempt++ {
		post(guest, "/api/auth/login", `{"email":"missing@example.com","password":"incorrect password"}`, 401)
	}
	throttled, _ := post(guest, "/api/auth/login", `{"email":"missing@example.com","password":"incorrect password"}`, 429)
	if throttled.Header.Get("Retry-After") == "" {
		t.Fatal("missing retry guidance")
	}
}
