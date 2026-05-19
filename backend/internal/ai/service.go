package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/guts-yang/hello-gutsyang/backend/internal/content"
	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

type Service struct {
	content *content.Service
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func NewService(contentSvc *content.Service, apiKey, baseURL, modelName string) *Service {
	return &Service{
		content: contentSvc,
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   modelName,
		// Bound the upstream call so a hung DeepSeek connection cannot pin a
		// goroutine and an inbound HTTP connection forever. Streaming responses
		// finish well within this budget; it primarily protects against silent
		// network blackholes.
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

func (s *Service) DemoMode() bool {
	return strings.TrimSpace(s.apiKey) == ""
}

func (s *Service) BuildPrompt(ctx context.Context, locale model.Locale) (string, error) {
	snapshot, err := s.content.Snapshot(ctx)
	if err != nil {
		return "", err
	}

	lang := "zh"
	ownerName := snapshot.Profile.NameZH
	if locale == model.LocaleEN {
		lang = "en"
		ownerName = snapshot.Profile.NameEN
	}

	section := func(value model.LocalizedString) string {
		if lang == "en" {
			return value.EN
		}
		return value.ZH
	}

	var projectLines []string
	for i, project := range snapshot.Projects {
		highlights := make([]string, 0, len(project.Highlights))
		for _, highlight := range project.Highlights {
			highlights = append(highlights, section(highlight))
		}
		projectLines = append(projectLines, fmt.Sprintf(
			"%d. (%s) %s\n   tagline: %s\n   summary: %s\n   tags: %s\n   highlights: %s",
			i+1,
			project.Kind,
			section(project.Title),
			section(project.Tagline),
			section(project.Summary),
			strings.Join(project.Tags, ", "),
			strings.Join(highlights, " | "),
		))
	}

	var experienceLines []string
	for i, experience := range snapshot.Experiences {
		metrics := make([]string, 0, len(experience.Metrics))
		for _, metric := range experience.Metrics {
			metrics = append(metrics, section(metric))
		}
		endAt := "present"
		if experience.EndedAt != "" {
			endAt = experience.EndedAt
		}
		experienceLines = append(experienceLines, fmt.Sprintf(
			"%d. %s — %s (%s to %s)\n   %s\n   metrics: %s",
			i+1,
			section(experience.Org),
			section(experience.Role),
			experience.StartedAt,
			endAt,
			section(experience.Summary),
			strings.Join(metrics, " | "),
		))
	}

	var honorLines []string
	for _, honor := range snapshot.Honors {
		honorLines = append(honorLines, fmt.Sprintf("- (%s) %s: %s", honor.Pillar, section(honor.Title), section(honor.Story)))
	}

	var educationLines []string
	for _, education := range snapshot.Education {
		endAt := "present"
		if education.EndedAt != "" {
			endAt = education.EndedAt
		}
		note := ""
		if education.Notes.ZH != "" || education.Notes.EN != "" {
			note = " — " + section(education.Notes)
		}
		educationLines = append(educationLines, fmt.Sprintf(
			"- %s, %s (%s to %s)%s",
			section(education.School),
			section(education.Degree),
			education.StartedAt,
			endAt,
			note,
		))
	}

	if locale == model.LocaleEN {
		return strings.Join([]string{
			fmt.Sprintf("You are the AI concierge of %s's personal website. Talk about him in third person, concise, friendly, and grounded in the data below.", ownerName),
			"Rules:",
			"1. Only answer questions about the site owner; gently redirect off-topic asks.",
			"2. Keep replies short (<= 80 words), high-signal, bullet points OK.",
			"3. If unsure, say \"the public materials don't cover that—reach out via GitHub / Email.\"",
			"4. Never invent projects, experiences, awards, or numbers beyond the data below.",
			"5. Always reply in the language the user wrote in.",
			"",
			"Profile data:",
			fmt.Sprintf("[BASIC]\nname: %s (handle: %s)\nrole: %s\nslogan: %s\nbio: %s", ownerName, snapshot.Profile.Handle, section(snapshot.Profile.Role), section(snapshot.Profile.Slogan), section(snapshot.Profile.Bio)),
			"[PROJECTS]\n" + strings.Join(projectLines, "\n\n"),
			"[EXPERIENCES]\n" + strings.Join(experienceLines, "\n\n"),
			"[HONORS]\n" + strings.Join(honorLines, "\n"),
			"[EDUCATION]\n" + strings.Join(educationLines, "\n"),
		}, "\n"), nil
	}

	return strings.Join([]string{
		fmt.Sprintf("你是 %s 个人网站的 AI 助手。你的职责是用第三人称（用“他/%s”），简洁、自然、客观地介绍这个网站主人。", ownerName, ownerName),
		"Rules:",
		"1. 只回答与网站主人本人相关的问题；无关请礼貌引导回主题。",
		"2. 回答简短（<=120字），重点突出，可以分点。",
		"3. 没把握就说“目前公开资料里没有提到，建议直接联系他的 GitHub / Email”。",
		"4. 禁止编造未在以下数据中出现的项目、经历、奖项或数字。",
		"5. 回答始终使用与提问者相同的语言。",
		"",
		"Profile data:",
		fmt.Sprintf("[BASIC]\nname: %s (handle: %s)\nrole: %s\nslogan: %s\nbio: %s", ownerName, snapshot.Profile.Handle, section(snapshot.Profile.Role), section(snapshot.Profile.Slogan), section(snapshot.Profile.Bio)),
		"[PROJECTS]\n" + strings.Join(projectLines, "\n\n"),
		"[EXPERIENCES]\n" + strings.Join(experienceLines, "\n\n"),
		"[HONORS]\n" + strings.Join(honorLines, "\n"),
		"[EDUCATION]\n" + strings.Join(educationLines, "\n"),
	}, "\n"), nil
}

func (s *Service) Stream(ctx context.Context, locale model.Locale, messages []Message) (*http.Response, error) {
	prompt, err := s.BuildPrompt(ctx, locale)
	if err != nil {
		return nil, err
	}

	if s.DemoMode() {
		text := "（演示模式）请在后端配置 DEEPSEEK_API_KEY 以启用实时回答。\n\n示例回答：他的核心方向是大模型机器遗忘学习与多智能体架构。"
		if locale == model.LocaleEN {
			text = "(Demo mode) Configure DEEPSEEK_API_KEY in the Go backend to enable live answers.\n\nExample: His focus is LLM machine unlearning and multi-agent orchestration."
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Type":  []string{"text/plain; charset=utf-8"},
				"Cache-Control": []string{"no-store"},
			},
			Body: io.NopCloser(strings.NewReader(text)),
		}, nil
	}

	payload := map[string]any{
		"model":       s.model,
		"stream":      true,
		"temperature": 0.6,
		"messages": append([]Message{{
			Role:    "system",
			Content: prompt,
		}}, messages...),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	return s.client.Do(req)
}
