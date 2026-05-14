-- Seed data mirrors lib/profile.ts so the site keeps the same content
-- whether it reads from Supabase or the local fallback.

insert into public.profile (id, name_zh, name_en, handle, role_zh, role_en, slogan_zh, slogan_en, bio_zh, bio_en, avatar_url, socials)
values (
  'main',
  '廖晨扬',
  'gutsyang',
  'gutsyang',
  'AI 算法工程师 · 全栈开发者',
  'AI Engineer · Full-stack Developer',
  '专注大模型机器遗忘学习与多智能体架构',
  'Focused on LLM machine unlearning & multi-agent architectures',
  '华南理工大学计算机科学专业，研究方向为大模型机器遗忘学习；同时具备多智能体系统、量化策略、全栈应用的工程经验。',
  'CS undergrad at South China University of Technology, researching LLM machine unlearning. I also build multi-agent systems, quant strategies, and full-stack apps.',
  '/avatar-placeholder.svg',
  '[
    {"type":"github","href":"https://github.com/guts-yang","label":"@gutsyang"},
    {"type":"email","href":"mailto:578165807@qq.com","label":"578165807@qq.com"},
    {"type":"wechat","href":"#wechat","label":"WeChat QR"}
  ]'::jsonb
)
on conflict (id) do update set
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  handle = excluded.handle,
  role_zh = excluded.role_zh,
  role_en = excluded.role_en,
  slogan_zh = excluded.slogan_zh,
  slogan_en = excluded.slogan_en,
  bio_zh = excluded.bio_zh,
  bio_en = excluded.bio_en,
  avatar_url = excluded.avatar_url,
  socials = excluded.socials;

insert into public.projects (slug, kind, title_zh, title_en, tagline_zh, tagline_en, summary_zh, summary_en, tags, highlights, started_at, display_order)
values
  (
    'llm-hessian-unlearning', 'academic',
    '基于 Hessian 矩阵的 LLM 机器遗忘学习',
    'LLM Machine Unlearning via Hessian Curvature',
    '让大模型「精确遗忘」指定知识，同时保住通用能力',
    'Precisely erase target knowledge from LLMs without breaking general ability',
    '提出基于二阶曲率信息的遗忘算子，对参数局部线性近似下的影响函数做加速近似，达到数倍于现有方法的遗忘效率，同时保留下游任务表现。',
    'Proposes a second-order influence-function approximation that erases targeted samples from a fine-tuned LLM with multiple-x speedup over baselines, while retaining downstream performance.',
    array['LLM','Unlearning','PyTorch','Hessian','Influence Function','NeurIPS Target'],
    '[
      {"zh":"相比 Gradient Ascent 基线提速 4-6 倍","en":"4-6x faster than gradient-ascent baseline"},
      {"zh":"在 7B / 13B 两个量级 LLM 上完成可复现实验","en":"Reproducible experiments on 7B and 13B LLMs"},
      {"zh":"保留下游 MMLU 平均得分回退 < 1%","en":"Downstream MMLU regression < 1%"}
    ]'::jsonb,
    '2025-03-01', 30
  ),
  (
    'langgraph-multi-agent', 'engineering',
    'LangGraph 多智能体协同架构',
    'LangGraph Multi-Agent Orchestration',
    '把规划、检索、写作、评审拆成可路由的图节点',
    'Plan / retrieve / write / review as routable graph nodes',
    '基于 LangGraph 设计可热插拔的智能体协同框架，支持任务路由、子图回滚、流式输出，已在 3 个真实业务场景落地。',
    'A pluggable multi-agent framework on LangGraph with task routing, subgraph rollback and streaming output. Deployed in three real-world use cases.',
    array['LangGraph','LangChain','Python','FastAPI','Multi-Agent'],
    '[
      {"zh":"可热插拔的子图节点，新增能力 < 1 天","en":"Hot-pluggable subgraph nodes; add a capability in < 1 day"},
      {"zh":"内置评审环节，端到端事实正确率提升 23%","en":"Built-in review loop boosts end-to-end factuality by 23%"}
    ]'::jsonb,
    '2024-09-01', 20
  ),
  (
    'a-stock-quant', 'engineering',
    'A 股量化分析系统',
    'A-Share Quant Analysis System',
    'SMC + 缠论混合策略 + 深度学习信号融合',
    'SMC + Chan Theory hybrid strategy with deep-learning signal fusion',
    '从行情拉取、特征工程、策略回测、信号告警一条龙，前端 Vue + ECharts，后端 Python + Pandas，模型层 PyTorch。',
    'End-to-end pipeline: data ingestion, feature engineering, backtesting, alerting. Vue + ECharts on the front, Python + Pandas on the back, PyTorch for models.',
    array['Vue','Python','Pandas','PyTorch','Quant'],
    '[
      {"zh":"近 12 个月模拟回测年化超额 18%","en":"Simulated alpha of 18% over the last 12 months"},
      {"zh":"引入 SMC 结构识别，假突破过滤率 +40%","en":"SMC structure detection cuts false breakouts by 40%"}
    ]'::jsonb,
    '2024-04-01', 10
  )
on conflict (slug) do nothing;

insert into public.experiences (slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en, metrics, started_at, display_order)
values (
  'iflytek-ai-contest',
  '科大讯飞 AI 开发者大赛', 'iFlytek AI Developer Contest',
  '校园发起人 / 队长', 'Campus Lead / Team Captain',
  '负责赛事在华南理工大学的招募与组织，统筹宣传、答疑与赛队组建，并带队进入复赛。',
  'Led campus recruiting and organization at SCUT, owning promotion, Q&A and team formation; advanced to the semifinal as captain.',
  '[
    {"zh":"招募 412 名参赛者","en":"Recruited 412 participants"},
    {"zh":"组建 38 支参赛队","en":"Formed 38 competing teams"},
    {"zh":"校内宣讲触达 2k+ 学生","en":"Reached 2k+ students via campus talks"}
  ]'::jsonb,
  '2024-10-01', 10
)
on conflict (slug) do nothing;

insert into public.honors (pillar, title_zh, title_en, story_zh, story_en, display_order) values
  ('morality',
   '领导力 · 十佳班集体统筹', 'Leadership · Top-10 Class Coordination',
   '担任班级负责人期间统筹活动与学风建设，所在班级获评校级十佳班集体。',
   'As class lead, organized activities and academic-style building; the class won the university Top-10 Class title.', 4),
  ('wisdom',
   '钻研力 · 跨学科理论实战', 'Curiosity · Cross-discipline Theory in Practice',
   '把 SMC、缠论这类金融理论与机器学习方法融合落地于真实交易研究，多次获得校级奖学金。',
   'Bridged finance theories (SMC, Chan) with ML to ship real trading research; multiple university scholarships.', 3),
  ('athletics',
   '抗压力 · 长征研学', 'Resilience · Long-March Field Study',
   '参与长征历史研学项目，徒步与高强度集训磨砺意志与团队协作。',
   'Joined a Long-March history field-study program; long-distance hikes and intensive training built grit and teamwork.', 2),
  ('labor',
   '奉献 · 百小时辅导', 'Contribution · 100+ Tutoring Hours',
   '编写校内教学辅导材料，累计 100+ 小时一对一辅导，帮助同学拿到关键学分。',
   'Authored in-house study material and delivered 100+ hours of one-on-one tutoring to peers.', 1);

insert into public.education (school_zh, school_en, degree_zh, degree_en, notes_zh, notes_en, started_at, display_order)
values (
  '华南理工大学', 'South China University of Technology',
  '计算机科学与技术 · 本科', 'B.Eng. in Computer Science',
  '主修方向：人工智能与系统软件；持有高中信息技术教师资格证。',
  'Focus: AI and systems software. Also holds a high-school IT teaching certification.',
  '2023-09-01', 10
);

insert into public.timeline (date, kind, title_zh, title_en, body_zh, body_en) values
  ('2023-09-01', 'edu',
   '入学 · 华南理工大学 CS', 'Enrolled · SCUT CS',
   '开始系统训练算法、系统、AI 三条主线。', 'Started a structured journey across algorithms, systems and AI.'),
  ('2024-04-01', 'project',
   '启动 · A 股量化分析系统', 'Kickoff · A-Share Quant System',
   '将 SMC 与缠论与深度学习融合。', 'Fused SMC and Chan theory with deep learning.'),
  ('2024-09-01', 'project',
   '启动 · LangGraph 多智能体', 'Kickoff · LangGraph Multi-Agent',
   '搭建可热插拔的智能体协同框架。', 'Built a hot-pluggable multi-agent framework.'),
  ('2024-10-01', 'work',
   '科大讯飞 AI 大赛 · 校园发起人', 'iFlytek AI Contest · Campus Lead',
   '招募 412 名参赛者，组建 38 支队伍。', 'Recruited 412 participants and formed 38 teams.'),
  ('2025-03-01', 'project',
   '启动 · LLM 机器遗忘学习', 'Kickoff · LLM Machine Unlearning',
   '基于 Hessian 曲率的二阶遗忘算子。', 'Second-order unlearning operator using Hessian curvature.');
