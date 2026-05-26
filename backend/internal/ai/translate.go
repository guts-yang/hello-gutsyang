package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Translate asks DeepSeek to translate every value in items from Chinese to
// English, preserving the keys. The return map mirrors items 1:1 -- the
// caller can rely on every input key being present in the output (filled
// with a sentinel "[EN] zh" string in demo mode when the API key is unset).
//
// Why a map-of-strings rather than per-field calls: bilingual portfolio data
// frequently shares context (a project's title, tagline and summary should
// translate consistently). One round-trip with all fields lets the model
// keep terminology aligned and amortises latency over a single request.
func (s *Service) Translate(ctx context.Context, items map[string]string) (map[string]string, error) {
	if len(items) == 0 {
		return map[string]string{}, nil
	}

	// Demo mode keeps every dev path working when the API key is absent --
	// tests, local first-runs, and CI all hit this branch.
	if s.DemoMode() {
		out := make(map[string]string, len(items))
		for k, v := range items {
			if strings.TrimSpace(v) == "" {
				out[k] = ""
				continue
			}
			out[k] = "[EN] " + v
		}
		return out, nil
	}

	prompt := buildTranslatePrompt()
	userMessage, err := json.Marshal(items)
	if err != nil {
		return nil, fmt.Errorf("ai.translate: marshal items: %w", err)
	}

	payload := map[string]any{
		"model":       s.model,
		"stream":      false,
		"temperature": 0.2,
		"response_format": map[string]string{
			"type": "json_object",
		},
		"messages": []Message{
			{Role: "system", Content: prompt},
			{Role: "user", Content: string(userMessage)},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("ai.translate: marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ai.translate: upstream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("ai.translate: upstream %d: %s", resp.StatusCode, string(raw))
	}

	var decoded struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, fmt.Errorf("ai.translate: decode response: %w", err)
	}
	if len(decoded.Choices) == 0 {
		return nil, errors.New("ai.translate: empty choices")
	}

	content := strings.TrimSpace(decoded.Choices[0].Message.Content)
	// DeepSeek occasionally wraps the JSON in a markdown fence even with
	// response_format=json_object; strip it defensively so the parse never
	// fails on a stray ``` line.
	content = stripJSONFence(content)

	parsed := make(map[string]string, len(items))
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, fmt.Errorf("ai.translate: parse content as JSON: %w (raw=%q)", err, content)
	}

	// Guarantee every input key has an output -- fall back to the original
	// Chinese if the model dropped a key, so the caller never has to do
	// nil-checks at the call site.
	out := make(map[string]string, len(items))
	for k, zh := range items {
		if en, ok := parsed[k]; ok {
			out[k] = en
		} else {
			out[k] = zh
		}
	}
	return out, nil
}

func buildTranslatePrompt() string {
	return strings.Join([]string{
		"You are a senior bilingual editor for a software engineer's personal portfolio.",
		"You receive a JSON object whose values are written in Chinese.",
		"Translate every value into natural, concise English suitable for a CV / About page.",
		"Rules:",
		"1. Output ONLY a JSON object with the same keys as the input, no prose, no markdown fence.",
		"2. Keep proper nouns and acronyms (GitHub, PyTorch, LLM, NeurIPS, SCUT, etc.) in their original form.",
		"3. For Chinese personal names, use pinyin in the conventional English order (e.g. 廖晨扬 -> Chenyang Liao).",
		"4. Preserve URLs, numbers, dates, and bracket/parenthesis structure verbatim.",
		"5. If a value is empty or whitespace, return an empty string for that key.",
		"6. Keep punctuation, line breaks, and casing professional and idiomatic.",
	}, "\n")
}

// stripJSONFence removes ``` / ```json fences if the model emitted them.
func stripJSONFence(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}
	// Drop the first fence line.
	if idx := strings.Index(s, "\n"); idx >= 0 {
		s = s[idx+1:]
	} else {
		return s
	}
	// Drop a trailing fence.
	if i := strings.LastIndex(s, "```"); i >= 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}
