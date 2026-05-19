package content

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

type Service struct {
	mu       sync.RWMutex
	filePath string
	data     model.ContentSnapshot
}

func NewService(dataDir string) (*Service, error) {
	filePath := filepath.Join(dataDir, "content.json")
	svc := &Service{filePath: filePath}
	if err := svc.load(); err != nil {
		return nil, err
	}
	return svc, nil
}

func (s *Service) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(s.filePath), 0o755); err != nil {
		return err
	}

	if _, err := os.Stat(s.filePath); errors.Is(err, os.ErrNotExist) {
		s.data = seedSnapshot()
		return s.persistLocked()
	}

	raw, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(raw, &s.data); err != nil {
		return fmt.Errorf("decode content snapshot: %w", err)
	}
	return nil
}

func (s *Service) persistLocked() error {
	body, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	// Atomic write: stage to a temp file in the same directory, then rename.
	// Prevents a half-written content.json on crash / power loss, which would
	// otherwise prevent the next startup from decoding the snapshot.
	tmp := s.filePath + ".tmp"
	if err := os.WriteFile(tmp, body, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, s.filePath); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func (s *Service) Home(ctx context.Context) (model.HomeContent, error) {
	select {
	case <-ctx.Done():
		return model.HomeContent{}, ctx.Err()
	default:
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	return model.HomeContent{
		Profile:     s.data.Profile,
		Projects:    publishedProjects(s.data.Projects),
		Experiences: publishedExperiences(s.data.Experiences),
		Honors:      publishedHonors(s.data.Honors),
		Education:   cloneEducation(s.data.Education),
		Timeline:    cloneTimeline(s.data.Timeline),
	}, nil
}

func (s *Service) Snapshot(ctx context.Context) (model.ContentSnapshot, error) {
	home, err := s.Home(ctx)
	if err != nil {
		return model.ContentSnapshot{}, err
	}
	return model.ContentSnapshot{
		Profile:     home.Profile,
		Projects:    home.Projects,
		Experiences: home.Experiences,
		Honors:      home.Honors,
		Education:   home.Education,
		Timeline:    home.Timeline,
	}, nil
}

func (s *Service) Profile(ctx context.Context) (model.Profile, error) {
	select {
	case <-ctx.Done():
		return model.Profile{}, ctx.Err()
	default:
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.Profile, nil
}

func (s *Service) UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error) {
	select {
	case <-ctx.Done():
		return model.Profile{}, ctx.Err()
	default:
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	next.ID = "main"
	next.UpdatedAt = time.Now().UTC()
	s.data.Profile = next
	if err := s.persistLocked(); err != nil {
		return model.Profile{}, err
	}
	return next, nil
}

func (s *Service) Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if includeDrafts {
		return cloneProjects(s.data.Projects), nil
	}
	return publishedProjects(s.data.Projects), nil
}

func (s *Service) ProjectBySlug(ctx context.Context, slug string) (*model.Project, error) {
	projects, err := s.Projects(ctx, false)
	if err != nil {
		return nil, err
	}
	for i := range projects {
		if projects[i].Slug == slug {
			project := projects[i]
			return &project, nil
		}
	}
	return nil, nil
}

func (s *Service) ProjectByID(ctx context.Context, id string) (*model.Project, error) {
	projects, err := s.Projects(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range projects {
		if projects[i].ID == id {
			project := projects[i]
			return &project, nil
		}
	}
	return nil, nil
}

func (s *Service) UpsertProject(ctx context.Context, next model.Project) (model.Project, error) {
	select {
	case <-ctx.Done():
		return model.Project{}, ctx.Err()
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if next.ID == "" {
		next.ID = randomID()
	}
	next.Slug = strings.TrimSpace(next.Slug)
	inserted := false
	for i := range s.data.Projects {
		if s.data.Projects[i].ID == next.ID {
			s.data.Projects[i] = next
			inserted = true
			break
		}
	}
	if !inserted {
		s.data.Projects = append(s.data.Projects, next)
	}
	sortProjects(s.data.Projects)
	if err := s.persistLocked(); err != nil {
		return model.Project{}, err
	}
	return next, nil
}

func (s *Service) DeleteProject(ctx context.Context, id string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Projects = slices.DeleteFunc(s.data.Projects, func(item model.Project) bool { return item.ID == id })
	return s.persistLocked()
}

func (s *Service) Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if includeDrafts {
		return cloneExperiences(s.data.Experiences), nil
	}
	return publishedExperiences(s.data.Experiences), nil
}

func (s *Service) ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error) {
	items, err := s.Experiences(ctx, false)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].Slug == slug {
			item := items[i]
			return &item, nil
		}
	}
	return nil, nil
}

func (s *Service) ExperienceByID(ctx context.Context, id string) (*model.Experience, error) {
	items, err := s.Experiences(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].ID == id {
			item := items[i]
			return &item, nil
		}
	}
	return nil, nil
}

func (s *Service) UpsertExperience(ctx context.Context, next model.Experience) (model.Experience, error) {
	select {
	case <-ctx.Done():
		return model.Experience{}, ctx.Err()
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if next.ID == "" {
		next.ID = randomID()
	}
	inserted := false
	for i := range s.data.Experiences {
		if s.data.Experiences[i].ID == next.ID {
			s.data.Experiences[i] = next
			inserted = true
			break
		}
	}
	if !inserted {
		s.data.Experiences = append(s.data.Experiences, next)
	}
	sortExperiences(s.data.Experiences)
	if err := s.persistLocked(); err != nil {
		return model.Experience{}, err
	}
	return next, nil
}

func (s *Service) DeleteExperience(ctx context.Context, id string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Experiences = slices.DeleteFunc(s.data.Experiences, func(item model.Experience) bool { return item.ID == id })
	return s.persistLocked()
}

func (s *Service) Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if includeDrafts {
		return cloneHonors(s.data.Honors), nil
	}
	return publishedHonors(s.data.Honors), nil
}

func (s *Service) HonorByID(ctx context.Context, id string) (*model.Honor, error) {
	items, err := s.Honors(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].ID == id {
			item := items[i]
			return &item, nil
		}
	}
	return nil, nil
}

func (s *Service) UpsertHonor(ctx context.Context, next model.Honor) (model.Honor, error) {
	select {
	case <-ctx.Done():
		return model.Honor{}, ctx.Err()
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if next.ID == "" {
		next.ID = randomID()
	}
	inserted := false
	for i := range s.data.Honors {
		if s.data.Honors[i].ID == next.ID {
			s.data.Honors[i] = next
			inserted = true
			break
		}
	}
	if !inserted {
		s.data.Honors = append(s.data.Honors, next)
	}
	sortHonors(s.data.Honors)
	if err := s.persistLocked(); err != nil {
		return model.Honor{}, err
	}
	return next, nil
}

func (s *Service) DeleteHonor(ctx context.Context, id string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Honors = slices.DeleteFunc(s.data.Honors, func(item model.Honor) bool { return item.ID == id })
	return s.persistLocked()
}

func (s *Service) Education(ctx context.Context) ([]model.Education, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneEducation(s.data.Education), nil
}

func (s *Service) Timeline(ctx context.Context) ([]model.TimelineEvent, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneTimeline(s.data.Timeline), nil
}

func cloneProjects(items []model.Project) []model.Project {
	out := append([]model.Project(nil), items...)
	sortProjects(out)
	return out
}

func publishedProjects(items []model.Project) []model.Project {
	out := make([]model.Project, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortProjects(out)
	return out
}

func sortProjects(items []model.Project) {
	slices.SortFunc(items, func(a, b model.Project) int {
		if a.DisplayOrder != b.DisplayOrder {
			return b.DisplayOrder - a.DisplayOrder
		}
		return strings.Compare(b.StartedAt, a.StartedAt)
	})
}

func cloneExperiences(items []model.Experience) []model.Experience {
	out := append([]model.Experience(nil), items...)
	sortExperiences(out)
	return out
}

func publishedExperiences(items []model.Experience) []model.Experience {
	out := make([]model.Experience, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortExperiences(out)
	return out
}

func sortExperiences(items []model.Experience) {
	slices.SortFunc(items, func(a, b model.Experience) int {
		if a.DisplayOrder != b.DisplayOrder {
			return b.DisplayOrder - a.DisplayOrder
		}
		return strings.Compare(b.StartedAt, a.StartedAt)
	})
}

func cloneHonors(items []model.Honor) []model.Honor {
	out := append([]model.Honor(nil), items...)
	sortHonors(out)
	return out
}

func publishedHonors(items []model.Honor) []model.Honor {
	out := make([]model.Honor, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortHonors(out)
	return out
}

func sortHonors(items []model.Honor) {
	slices.SortFunc(items, func(a, b model.Honor) int { return b.DisplayOrder - a.DisplayOrder })
}

func cloneEducation(items []model.Education) []model.Education {
	out := append([]model.Education(nil), items...)
	slices.SortFunc(out, func(a, b model.Education) int { return b.DisplayOrder - a.DisplayOrder })
	return out
}

func cloneTimeline(items []model.TimelineEvent) []model.TimelineEvent {
	out := append([]model.TimelineEvent(nil), items...)
	slices.SortFunc(out, func(a, b model.TimelineEvent) int { return strings.Compare(a.Date, b.Date) })
	return out
}

func randomID() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}

func seedSnapshot() model.ContentSnapshot {
	now := time.Now().UTC()
	return model.ContentSnapshot{
		Profile: model.Profile{
			ID:        "main",
			NameZH:    "廖晨扬",
			NameEN:    "gutsyang",
			Handle:    "gutsyang",
			AvatarURL: "/avatar-placeholder.svg",
			Role: model.LocalizedString{
				ZH: "AI 算法工程师 · 全栈开发者",
				EN: "AI Engineer · Full-stack Developer",
			},
			Slogan: model.LocalizedString{
				ZH: "专注大模型机器遗忘学习与多智能体架构",
				EN: "Focused on LLM machine unlearning & multi-agent architectures",
			},
			Bio: model.LocalizedString{
				ZH: "华南理工大学计算机科学专业，研究方向为大模型机器遗忘学习；同时具备多智能体系统、量化策略、全栈应用的工程经验。",
				EN: "CS undergrad at South China University of Technology, researching LLM machine unlearning. I also build multi-agent systems, quant strategies, and full-stack apps.",
			},
			Socials: []model.SocialLink{
				{Type: "github", Href: "https://github.com/guts-yang", Label: "@gutsyang"},
				{Type: "wechat", Href: "#wechat", Label: "WeChat QR"},
			},
			UpdatedAt: now,
		},
		Projects: []model.Project{
			{
				ID:   "project-llm-hessian-unlearning",
				Slug: "llm-hessian-unlearning",
				Kind: "academic",
				Title: model.LocalizedString{
					ZH: "基于 Hessian 矩阵的 LLM 机器遗忘学习",
					EN: "LLM Machine Unlearning via Hessian Curvature",
				},
				Tagline: model.LocalizedString{
					ZH: "让大模型「精确遗忘」指定知识，同时保住通用能力",
					EN: "Precisely erase target knowledge from LLMs without breaking general ability",
				},
				Summary: model.LocalizedString{
					ZH: "提出基于二阶曲率信息的遗忘算子，对参数局部线性近似下的影响函数做加速近似，达到数倍于现有方法的遗忘效率，同时保留下游任务表现。",
					EN: "Proposes a second-order influence-function approximation that erases targeted samples from a fine-tuned LLM with multiple-x speedup over baselines, while retaining downstream performance.",
				},
				Tags: []string{"LLM", "Unlearning", "PyTorch", "Hessian", "Influence Function", "NeurIPS Target"},
				Highlights: []model.LocalizedString{
					{ZH: "相比 Gradient Ascent 基线提速 4-6 倍", EN: "4-6x faster than gradient-ascent baseline"},
					{ZH: "在 7B / 13B 两个量级 LLM 上完成可复现实验", EN: "Reproducible experiments on 7B and 13B LLMs"},
					{ZH: "保留下游 MMLU 平均得分回退 < 1%", EN: "Downstream MMLU regression < 1%"},
				},
				StartedAt:    "2025-03",
				DisplayOrder: 30,
				IsPublished:  true,
			},
			{
				ID:   "project-langgraph-multi-agent",
				Slug: "langgraph-multi-agent",
				Kind: "engineering",
				Title: model.LocalizedString{
					ZH: "LangGraph 多智能体协同架构",
					EN: "LangGraph Multi-Agent Orchestration",
				},
				Tagline: model.LocalizedString{
					ZH: "把规划、检索、写作、评审拆成可路由的图节点",
					EN: "Plan / retrieve / write / review as routable graph nodes",
				},
				Summary: model.LocalizedString{
					ZH: "基于 LangGraph 设计可热插拔的智能体协同框架，支持任务路由、子图回滚、流式输出，已在 3 个真实业务场景落地。",
					EN: "A pluggable multi-agent framework on LangGraph with task routing, subgraph rollback and streaming output. Deployed in three real-world use cases.",
				},
				Tags: []string{"LangGraph", "LangChain", "Python", "FastAPI", "Multi-Agent"},
				Highlights: []model.LocalizedString{
					{ZH: "可热插拔的子图节点，新增能力 < 1 天", EN: "Hot-pluggable subgraph nodes; add a capability in < 1 day"},
					{ZH: "内置评审环节，端到端事实正确率提升 23%", EN: "Built-in review loop boosts end-to-end factuality by 23%"},
				},
				StartedAt:    "2024-09",
				DisplayOrder: 20,
				IsPublished:  true,
			},
			{
				ID:   "project-a-stock-quant",
				Slug: "a-stock-quant",
				Kind: "engineering",
				Title: model.LocalizedString{
					ZH: "A 股量化分析系统",
					EN: "A-Share Quant Analysis System",
				},
				Tagline: model.LocalizedString{
					ZH: "SMC + 缠论混合策略 + 深度学习信号融合",
					EN: "SMC + Chan Theory hybrid strategy with deep-learning signal fusion",
				},
				Summary: model.LocalizedString{
					ZH: "从行情拉取、特征工程、策略回测、信号告警一条龙，前端 Vue + ECharts，后端 Python + Pandas，模型层 PyTorch。",
					EN: "End-to-end pipeline: data ingestion, feature engineering, backtesting, alerting. Vue + ECharts on the front, Python + Pandas on the back, PyTorch for models.",
				},
				Tags: []string{"Vue", "Python", "Pandas", "PyTorch", "Quant"},
				Highlights: []model.LocalizedString{
					{ZH: "近 12 个月模拟回测年化超额 18%", EN: "Simulated alpha of 18% over the last 12 months"},
					{ZH: "引入 SMC 结构识别，假突破过滤率 +40%", EN: "SMC structure detection cuts false breakouts by 40%"},
				},
				StartedAt:    "2024-04",
				DisplayOrder: 10,
				IsPublished:  true,
			},
		},
		Experiences: []model.Experience{
			{
				ID:   "experience-iflytek-ai-contest",
				Slug: "iflytek-ai-contest",
				Org: model.LocalizedString{
					ZH: "科大讯飞 AI 开发者大赛",
					EN: "iFlytek AI Developer Contest",
				},
				Role: model.LocalizedString{
					ZH: "校园发起人 / 队长",
					EN: "Campus Lead / Team Captain",
				},
				Summary: model.LocalizedString{
					ZH: "负责赛事在华南理工大学的招募与组织，统筹宣传、答疑与赛队组建，并带队进入复赛。",
					EN: "Led campus recruiting and organization at SCUT, owning promotion, Q&A and team formation; advanced to the semifinal as captain.",
				},
				Metrics: []model.LocalizedString{
					{ZH: "招募 412 名参赛者", EN: "Recruited 412 participants"},
					{ZH: "组建 38 支参赛队", EN: "Formed 38 competing teams"},
					{ZH: "校内宣讲触达 2k+ 学生", EN: "Reached 2k+ students via campus talks"},
				},
				StartedAt:    "2024-10",
				DisplayOrder: 10,
				IsPublished:  true,
			},
		},
		Honors: []model.Honor{
			{
				ID:     "honor-morality",
				Pillar: "morality",
				Title: model.LocalizedString{
					ZH: "领导力 · 十佳班集体统筹",
					EN: "Leadership · Top-10 Class Coordination",
				},
				Story: model.LocalizedString{
					ZH: "担任班级负责人期间统筹活动与学风建设，所在班级获评校级十佳班集体。",
					EN: "As class lead, organized activities and academic-style building; the class won the university Top-10 Class title.",
				},
				DisplayOrder: 40,
				IsPublished:  true,
			},
			{
				ID:     "honor-wisdom",
				Pillar: "wisdom",
				Title: model.LocalizedString{
					ZH: "钻研力 · 跨学科理论实战",
					EN: "Curiosity · Cross-discipline Theory in Practice",
				},
				Story: model.LocalizedString{
					ZH: "把 SMC、缠论这类金融理论与机器学习方法融合落地于真实交易研究，多次获得校级奖学金。",
					EN: "Bridged finance theories (SMC, Chan) with ML to ship real trading research; multiple university scholarships.",
				},
				DisplayOrder: 30,
				IsPublished:  true,
			},
			{
				ID:     "honor-athletics",
				Pillar: "athletics",
				Title: model.LocalizedString{
					ZH: "抗压力 · 长征研学",
					EN: "Resilience · Long-March Field Study",
				},
				Story: model.LocalizedString{
					ZH: "参与长征历史研学项目，徒步与高强度集训磨砺意志与团队协作。",
					EN: "Joined a Long-March history field-study program; long-distance hikes and intensive training built grit and teamwork.",
				},
				DisplayOrder: 20,
				IsPublished:  true,
			},
			{
				ID:     "honor-labor",
				Pillar: "labor",
				Title: model.LocalizedString{
					ZH: "奉献 · 百小时辅导",
					EN: "Contribution · 100+ Tutoring Hours",
				},
				Story: model.LocalizedString{
					ZH: "编写校内教学辅导材料，累计 100+ 小时一对一辅导，帮助同学拿到关键学分。",
					EN: "Authored in-house study material and delivered 100+ hours of one-on-one tutoring to peers.",
				},
				DisplayOrder: 10,
				IsPublished:  true,
			},
		},
		Education: []model.Education{
			{
				ID: "education-scut",
				School: model.LocalizedString{
					ZH: "华南理工大学",
					EN: "South China University of Technology",
				},
				Degree: model.LocalizedString{
					ZH: "计算机科学与技术 · 本科",
					EN: "B.Eng. in Computer Science",
				},
				Notes: model.LocalizedString{
					ZH: "主修方向：人工智能与系统软件；持有高中信息技术教师资格证。",
					EN: "Focus: AI and systems software. Also holds a high-school IT teaching certification.",
				},
				StartedAt:    "2023-09",
				DisplayOrder: 10,
			},
		},
		Timeline: []model.TimelineEvent{
			{
				ID:   "timeline-2023-09",
				Date: "2023-09",
				Kind: "edu",
				Title: model.LocalizedString{
					ZH: "入学 · 华南理工大学 CS",
					EN: "Enrolled · SCUT CS",
				},
				Body: model.LocalizedString{
					ZH: "开始系统训练算法、系统、AI 三条主线。",
					EN: "Started a structured journey across algorithms, systems and AI.",
				},
			},
			{
				ID:   "timeline-2024-04",
				Date: "2024-04",
				Kind: "project",
				Title: model.LocalizedString{
					ZH: "启动 · A 股量化分析系统",
					EN: "Kickoff · A-Share Quant System",
				},
				Body: model.LocalizedString{
					ZH: "将 SMC 与缠论与深度学习融合。",
					EN: "Fused SMC and Chan theory with deep learning.",
				},
			},
			{
				ID:   "timeline-2024-09",
				Date: "2024-09",
				Kind: "project",
				Title: model.LocalizedString{
					ZH: "启动 · LangGraph 多智能体",
					EN: "Kickoff · LangGraph Multi-Agent",
				},
				Body: model.LocalizedString{
					ZH: "搭建可热插拔的智能体协同框架。",
					EN: "Built a hot-pluggable multi-agent framework.",
				},
			},
			{
				ID:   "timeline-2024-10",
				Date: "2024-10",
				Kind: "work",
				Title: model.LocalizedString{
					ZH: "科大讯飞 AI 大赛 · 校园发起人",
					EN: "iFlytek AI Contest · Campus Lead",
				},
				Body: model.LocalizedString{
					ZH: "招募 412 名参赛者，组建 38 支队伍。",
					EN: "Recruited 412 participants and formed 38 teams.",
				},
			},
			{
				ID:   "timeline-2025-03",
				Date: "2025-03",
				Kind: "project",
				Title: model.LocalizedString{
					ZH: "启动 · LLM 机器遗忘学习",
					EN: "Kickoff · LLM Machine Unlearning",
				},
				Body: model.LocalizedString{
					ZH: "基于 Hessian 曲率的二阶遗忘算子。",
					EN: "Second-order unlearning operator using Hessian curvature.",
				},
			},
		},
	}
}
