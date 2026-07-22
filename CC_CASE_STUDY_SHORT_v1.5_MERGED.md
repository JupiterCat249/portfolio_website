# CC Case Study / Presentation Short Version v1.5

> 目标：用于 10 分钟课堂汇报、作品集页面初稿、后续个人陈述提炼。  
> 原则：只保留最重要的信息，不写论文，不堆设计理论。

---

## 1. 项目一句话

**ChatCopilot（CC）是一个嵌入现有聊天软件的 AI 沟通辅助平台。它不替用户聊天，而是在用户需要时帮助理解对方意图、整理自己的想法，并生成符合用户本人风格的回复建议。**

核心观点：**AI 应该适应人，而不是要求人反复适应 AI。**

---

## 2. 项目起点：为什么做 CC？

CC 起源于我在 QQ 绘画群中持续约三年的观察。群友分享作品时，经常只发一张图，却无法说明创作意图；其他人不知道他想要什么反馈，往往选择忽略。即使有人主动询问，创作者也常常需要多轮引导，才能慢慢说出自己的真实想法。

这个现象让我意识到，沟通困难不只是“不会说漂亮话”，而是很多人甚至还没整理清楚自己想表达什么，也不知道别人如何理解自己。后来我在做 QQ 群 AI Agent 时想到：如果 AI 能组织语言，也许它不应该只作为聊天对象，而可以帮助人类完成真实沟通。

---

## 3. Research：我发现了什么？

我进行了 6 位用户访谈，覆盖男性/女性、年轻人/中年人。访谈不是为了验证已有方案，而是为了理解：**如果 AI 要帮助沟通，它真正应该帮什么？**

核心发现有两个：

1. **Understanding / 理解**：用户常常不知道对方真实意图、情绪和关系状态。
2. **Expression / 表达**：用户即使有想法，也不知道如何用合适的方式说出来。

因此，CC 的重点不是“帮用户润色”，而是：**先判断沟通状况，再辅助表达。** 如果对方意图判断错了，回复写得再好也没有意义。

---

## 4. Competitive Analysis：为什么现有模式不够？

| 模式 | 代表产品 | 局限 |
|---|---|---|
| ChatBot | ChatGPT / DeepSeek / Claude | 需要用户主动解释问题；用户必须知道该问什么 |
| Writing Assistant | Grammarly / Apple Writing Tools / 邮件润色 | 只优化已有文本，不理解关系与沟通环境 |
| Agent | Operator / Manus 类产品 | 适合执行任务，但在人际沟通中容易越权或误判时机 |
| AI Friend | Character.AI / Replika 类产品 | 适合陪伴和倾诉，但不是嵌入真实聊天场景的即时辅助 |
| CC | ChatCopilot | 通过上下文、Memory 和用户输入，帮助用户理解沟通状态并选择表达方式 |

CC 的差异不是模型更强，而是交互模式不同：**它不是让用户离开聊天去问 AI，而是让 AI 嵌入真实聊天场景，成为轻量、透明、由用户控制的沟通辅助层。**

---

## 5. User Flow

| 阶段 | 用户操作 | 用户心理 | 系统行为 |
|---|---|---|---|
| 遇到困难 | 停在聊天界面 | “我不知道他什么意思 / 我不知道怎么回。” | CC 不主动打扰 |
| 可选输入 | 用户先写一点想法 | “我大概想这么说，但不确定合适不合适。” | 输入内容进入分析 |
| 一键分析 | 点击 CC 按钮 | “希望 AI 帮我判断当前状况。” | 读取上下文、Memory、用户输入 |
| 理解状态 | 查看分析 | “对方真正想表达什么？” | 分析对方意图与用户意图 |
| 选择建议 | 查看短/中/长回复 | “哪个更像我会说的话？” | 提供不同长度建议 |
| 修改发送 | 用户编辑后发送 | “最终表达仍然由我决定。” | CC 不自动发送 |

---

## 6. Design Principles in Action：原则如何落地？

这一部分将 Design Philosophy 和 Key Design Decisions 合并。因为设计原则不应该停留在口号，而应该体现在具体交互决策中。

| 设计原则 | 对应决策 | 目的 |
|---|---|---|
| Shared Cognition / 共享认知 | Two-stage Memory Retrieval | 让 AI 尽量掌握用户已掌握的信息 |
| User Agency / 用户主导 | One-click Analysis | 用户主动触发，AI 不越权 |
| Transparency / 透明可控 | Editable Memory / Prompt | 用户可查看并修正 AI 理解 |
| Authentic Expression / 真实表达 | Language Style Memory | 建议更像用户本人，而不是泛用 AI 回复 |

### Principle 1：Shared Cognition → Two-stage Memory Retrieval

用户不应该每次都向 AI 重新解释自己。CC 通过聊天上下文、联系人记忆、用户语言样本等信息，让 AI 尽可能与用户保持认知同步，站在用户角度思考。

旧方案只加载当前联系人记忆，能应付多数简单场景，但跨联系人、跨关系时会出现 AI 与用户认知不同步的问题。新方案先上传全局 Memory 索引，让 AI 判断需要哪些信息，再读取相关记忆和人物背景。目标不是让 AI 全知全能，而是让 AI 至少掌握用户已经掌握的信息。

### Principle 2：User Agency → One-click Analysis

AI 不应该擅自替用户行动。沟通涉及现实关系和复杂情绪，AI 不可能掌握全部信息。因此 CC 选择一键触发，而不是自动提醒或自动 Agent。

一键分析让主动权始终属于用户，同时保持 UI 轻量，方便嵌入现有聊天平台。AI 负责分析和建议，用户负责判断、修改和发送。

### Principle 3：Transparency → Editable Memory / Prompt

AI 越了解用户，越需要透明。如果 AI 说“我记住了”，但用户看不到它记住了什么，就无法真正信任它。

CC 公开用户记忆、联系人记忆、模块化知识和任务 Prompt，让用户可以直接修正 AI 的理解，而不是反复用对话要求 AI 修改。透明不是为了让所有用户每天检查，而是为了在需要时拥有控制权。

### Principle 4：Authentic Expression → Language Style Memory

测试用户反馈：AI 的建议“很有启发，但不能直接用”。这说明 AI 能帮助打开思路，但表达不像用户本人。

因此我加入用户语言样本记忆，让 AI 参考用户自己的说话方式。CC 不希望用户依赖 AI 伪装出一个虚假的高情商人设，而是帮助用户更真实地表达自己。

---

## 7. Testing & Iteration

### Iteration 1：Memory Retrieval 重构

开发中发现，旧方案虽然能应付多数场景，但一旦 AI 与用户掌握的信息不一致，信任会快速下降。因此系统改为“全局 Memory 索引 → AI 选择相关记忆 → 加载关联背景”的双阶段检索。

### Iteration 2：Language Style Memory

测试用户反馈 AI 建议有参考价值，但不能直接使用。我的判断是：问题不只是内容正确与否，而是建议不像用户本人。因此新增语言样本记忆，让建议更贴近用户自己的表达方式。

---

## 8. Reflection + Future：这个项目说明了什么？

项目初期，我并不知道 AI 到底如何帮助沟通。通过长期观察和访谈，我逐渐发现沟通困难的核心是理解与表达，而不是简单的语言润色。

通过原型开发，我进一步意识到，AI 辅助沟通的难点不只是模型能力，而是人与 AI 之间是否能建立共享认知、透明关系和用户控制权。CC 最终不是一个“自动替人聊天”的工具，而是一种 Human-AI Communication 模式：AI 帮助用户理解情况、打开思路、组织表达，但最终决定权始终属于用户。

这个反思也决定了下一步方向：我会继续在更多聊天平台中验证 CC，而不局限于 QQ；同时打磨 UI 系统，让 Memory 管理、一键分析和回复建议更清晰、更美观、更容易使用。后续也需要扩大测试样本，验证 CC 在日常社交、创作社区和工作沟通中的不同价值。

---

# Presentation

## Personal Statement

**Prototype-driven Interaction Designer**

I design and prototype human-centered systems that help people understand, control, and collaborate with technology.

## 10-Minute Presentation Flow

0. 30s - 自我介绍，personal statement
1. 30s — 项目一句话：CC 是嵌入聊天软件的 AI 沟通辅助平台。
2. 1min — QQ 绘画群三年观察：很多人有想法但说不出来。
3. 1min — Research：6 位访谈，发现核心需求是理解与表达。
4. 1min — 竞品分析：ChatBot / Writing Assistant / Agent 都不能完整解决真实沟通问题。
5. 1min — User Flow：从困惑到一键分析，再到短中长建议。
6. 2min — Design Principles in Action：共享认知、用户主导、透明可控、真实表达如何落地。
7. 1min — Testing：两个真实迭代。
8. 1min — Reflection + Future：AI 应理解人，而不是要求人适应 AI。
