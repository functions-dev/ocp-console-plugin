package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
)

var (
	githubClientID     = os.Getenv("GITHUB_CLIENT_ID")
	githubClientSecret = os.Getenv("GITHUB_CLIENT_SECRET")
)

func handleOAuthConfig(w http.ResponseWriter, _ *http.Request) {
	enabled := githubClientID != "" && githubClientSecret != ""
	cid := ""
	if enabled {
		cid = githubClientID
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"client_id": cid,
		"enabled":   enabled,
	})
}

type oauthCallbackRequest struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"code_verifier"`
}

var validOAuthParam = regexp.MustCompile(`^[a-zA-Z0-9_\-]+$`)

func handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if githubClientID == "" || githubClientSecret == "" {
		jsonError(w, "OAuth is not configured on this server", http.StatusServiceUnavailable)
		return
	}

	var req oauthCallbackRequest
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if !validOAuthParam.MatchString(req.Code) {
		jsonError(w, "invalid authorization code", http.StatusBadRequest)
		return
	}
	if !validOAuthParam.MatchString(req.CodeVerifier) {
		jsonError(w, "invalid code verifier", http.StatusBadRequest)
		return
	}

	form := url.Values{
		"client_id":     {githubClientID},
		"client_secret": {githubClientSecret},
		"code":          {req.Code},
		"code_verifier": {req.CodeVerifier},
	}
	ghReq, err := http.NewRequestWithContext(r.Context(), "POST", "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		jsonError(w, "failed to build token request", http.StatusInternalServerError)
		return
	}
	ghReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	ghReq.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(ghReq)
	if err != nil {
		jsonError(w, "failed to exchange token with GitHub: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		jsonError(w, fmt.Sprintf("GitHub returned HTTP %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if err != nil {
		jsonError(w, "failed to read GitHub response", http.StatusBadGateway)
		return
	}

	var ghResp map[string]any
	if err := json.Unmarshal(body, &ghResp); err != nil {
		jsonError(w, "invalid response from GitHub", http.StatusBadGateway)
		return
	}

	if errMsg, ok := ghResp["error"]; ok {
		desc, _ := ghResp["error_description"].(string)
		jsonError(w, fmt.Sprintf("%v: %s", errMsg, desc), http.StatusUnauthorized)
		return
	}

	token, _ := ghResp["access_token"].(string)
	if token == "" {
		jsonError(w, "no access_token in GitHub response", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"access_token": token})
}
