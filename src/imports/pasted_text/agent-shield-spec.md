Create a **high-fidelity, polished, interactive desktop web application prototype** for my hackathon project **AGENTSHIELD**.

The prototype is being presented to **hackathon judges**, so prioritize **professional product design, visual impact, clarity, technical credibility, and an impressive live-demo experience**.

This should NOT look like a generic student dashboard, template, or simple AI mockup.

It should look like a **real enterprise AI security product / cybersecurity SaaS platform** that could plausibly be used by AI engineering, platform, security, and compliance teams.

---

# 1. PRODUCT IDENTITY

### Product name

**AgentShield**

### Main tagline

**A firewall for what AI agents are allowed to do, not just say.**

### Supporting statement

**Giving AI agents power without giving them unchecked authority.**

### Core concept

AgentShield is a security and governance layer positioned between an autonomous AI agent and the real-world tools it can access.

The AI agent may request actions such as:

* Delete CRM records
* Send emails
* Make financial transactions
* Modify production infrastructure
* Export sensitive information
* Issue refunds
* Force-push code
* Terminate production instances

Every tool call must pass through AgentShield BEFORE execution.

The fundamental principle is:

**The AI agent should never be trusted to authorize its own actions.**

The LLM can understand intent and produce a structured proposed action, but it must NOT control the final authorization decision.

AgentShield independently evaluates every proposed action using:

**Agent → Tool Call → AgentShield Interceptor → Risk Engine → Policy Engine → Decision → Execution / Human Approval / Block → Audit Log**

---

# 2. CORE PRODUCT EXPERIENCE

The main product should be a **security operations dashboard** centered around real-time AI-agent activity.

The judge should immediately understand:

> "An AI agent is trying to perform an action. AgentShield intercepts it, explains the risk, applies policy, and decides whether it can happen."

The dashboard should make this visually obvious.

The main navigation should contain approximately:

* Overview
* Live Actions
* Approvals
* Risk Engine
* Policies
* Agents
* Audit Log
* Recovery
* Settings

Include a prominent **AgentShield logo/icon** and a strong security-oriented visual identity.

---

# 3. VISUAL DESIGN DIRECTION

Use a premium **AI security / cybersecurity / enterprise infrastructure** aesthetic.

### Color system

Primary background:

* Very dark navy / near-black
* Subtle blue-black gradients

Primary accent:

* Electric blue
* Indigo / subtle purple

Decision colors:

* **GREEN = ALLOW**
* **AMBER/YELLOW = REQUIRE APPROVAL**
* **RED = BLOCK / CRITICAL**

Risk visualization should consistently use these colors throughout the prototype.

Do NOT make the interface excessively neon or "gaming style."

It should feel:

**Premium + Secure + Technical + Trustworthy + Enterprise + Modern**

Use subtle:

* Glassmorphism only where appropriate
* Layered dark panels
* Soft shadows
* Thin borders
* Subtle gradients
* Glow around important security states
* Fine grid/background texture
* Small status indicators
* Professional data visualization

Avoid:

* Excessive gradients
* Giant decorative illustrations
* Cartoon graphics
* Excessive rounded cards
* Huge meaningless numbers
* Generic AI robot imagery
* Stock-photo style imagery
* Overly colorful dashboards

---

# 4. TYPOGRAPHY

Use one clean modern sans-serif typeface throughout.

Typography hierarchy must be extremely clear:

* Large page title
* Medium section headings
* Small uppercase security labels
* Compact metadata
* Monospace styling for:

  * tool names
  * action IDs
  * policy IDs
  * API/tool parameters
  * timestamps
  * technical values

Make the interface feel like a blend of:

**enterprise security console + developer platform + AI infrastructure product**

---

# 5. MAIN DASHBOARD

Create a highly polished **AgentShield Security Overview** page.

Header:

**AgentShield Security Console**

Subtitle:

**Monitor, authorize and control autonomous agent actions in real time.**

Top-right:

* Organization selector
* Environment selector: `Production`
* Notifications
* User/security-admin avatar

### KPI cards

Display:

**Protected Agents**
`12`

**Actions Intercepted**
`18,492`

**Blocked**
`143`

**Pending Approval**
`7`

**Auto Allowed**
`18,342`

**Critical Events**
`4`

Use realistic sample data.

Do not make these numbers unnecessarily exaggerated.

### Main live activity section

Title:

**Live Agent Activity**

Show a real-time stream of recent agent actions.

Example rows:

`CRM Agent`
→ `deleteCustomers(147)`
→ `CRITICAL`
→ `BLOCKED`

`Sales Agent`
→ `sendFollowUpEmails(38)`
→ `MEDIUM-HIGH`
→ `APPROVAL REQUIRED`

`Research Agent`
→ `readKnowledgeBase(12)`
→ `LOW`
→ `AUTO ALLOWED`

Each row should show:

* Agent
* Tool
* Action
* Scope
* Risk
* Decision
* Timestamp

Make the latest activity visually highlighted as if it is arriving live.

---

# 6. MOST IMPORTANT SCREEN — LIVE ACTION INTERCEPTION

Create a dedicated **Live Actions / Decision Center** screen.

This is the most important screen in the entire prototype because it represents the central AgentShield value proposition.

At the top show:

**AGENT ACTION INTERCEPTED**

Then create a horizontal visual pipeline:

**AI AGENT**
→
**INTERCEPTED**
→
**RISK ENGINE**
→
**POLICY ENGINE**
→
**DECISION**

Make the current action visually travel through these stages.

Use a subtle animated flow line / glowing node / progress state.

The judge should immediately understand:

> The action has NOT reached the real tool yet.

---

# 7. DEMO SCENARIO 1 — CRITICAL BLOCK

This is the hero interaction and should receive the strongest visual treatment.

Scenario:

User request:

**"Clean up inactive CRM customers."**

Agent proposes:

`deleteCustomers(147)`

Display:

### Proposed action

**Delete 147 inactive customers**

Tool:

`CRM.deleteCustomers`

Agent:

`CRM Cleanup Agent`

Target:

`147 customer records`

Data classification:

**PII / Sensitive**

External impact:

**None**

Reversibility:

**Irreversible**

---

# 8. RISK ENGINE VISUALIZATION

Show a beautiful large risk score:

# 100 / 100

Status:

**CRITICAL RISK**

Below it show the exact deterministic scoring factors.

### Risk breakdown

**DELETE**
`+80`

**Large scope (>100)**
`+10`

**Sensitive data**
`+5`

**Irreversible action**
`+20`

Raw score:

`115`

Final score:

`100 / 100`

Add a clean risk meter / progress bar / circular gauge.

Very important:

Display a small explanation:

**Deterministic Risk Engine**

"Score calculated from explicit security factors. The LLM does not control the risk score or final authorization decision."

This is one of AgentShield's most important differentiators.

---

# 9. POLICY ENGINE

Under the risk breakdown display:

### Policy Evaluation

Show:

`bulk_delete_guard`

Rule:

`IF action == "delete" AND scope.count > 100`

Result:

# BLOCK

Then show:

**Policy matched**

**Execution prevented**

Use a red security state but keep it professional.

Add a visual security-lock / shield icon.

---

# 10. FINAL BLOCK STATE

Make the final decision visually dramatic but professional.

Large:

# BLOCKED

Supporting text:

**147 customer records were not deleted.**

Then:

**Agent request intercepted before execution.**

Show three indicators:

`Risk: 100/100`

`Policy: bulk_delete_guard`

`Execution: Prevented`

Then provide:

`View Audit Event`

This should be one of the strongest "wow" moments of the prototype.

---

# 11. AUDIT EVENT DRAWER

When the user clicks:

**View Audit Event**

Open a polished right-side drawer or modal.

Title:

**Authorization Event**

Show:

* Action ID
* Agent ID
* Agent name
* Requested tool
* Requested operation
* Parameters
* Risk score
* Risk factors
* Policy triggered
* Decision
* Timestamp
* Execution status
* Data classification
* Reversibility
* Approver if applicable

Use a structured JSON/code-like section for technical details.

Example:

```text
action_id:
ash_8f31d9

agent:
crm-cleanup-agent

tool:
crm.deleteCustomers

scope:
147

risk:
100

decision:
BLOCK

policy:
bulk_delete_guard

executed:
false
```

This should visually communicate **auditability and technical depth**.

---

# 12. DEMO SCENARIO 2 — REQUIRE HUMAN APPROVAL

Create another live action:

User request:

**"Send follow-up emails to 38 leads."**

Agent proposes:

`sendFollowUpEmails(38)`

Risk score:

# 58 / 100

Status:

**MEDIUM-HIGH**

Risk factors:

* EMAIL base risk `+30`
* Moderate scope `+15`
* External impact `+10`
* Reversible `+3`

Decision:

# REQUIRE APPROVAL

---

# 13. HUMAN APPROVAL EXPERIENCE

Create a dedicated **Approval Queue**.

Display a large approval card:

### Human approval required

**Sales Follow-up Agent**

wants to:

**Send follow-up emails to 38 leads**

Risk:

`58 / 100`

Policy:

`external_email_review`

Impact:

`External recipients`

Then show the risk factor explanation clearly.

Include two large buttons:

**APPROVE ACTION**

**DENY ACTION**

The APPROVE button should be visually prominent but never overly flashy.

Include:

**Approval expires in 01:42**

Simulate the approval arriving in real time.

Add a small notification/toast:

**New approval request received**

This should communicate the WebSocket / real-time concept visually.

---

# 14. APPROVAL RESULT

When APPROVE is clicked:

Show a short success state:

**ACTION APPROVED**

Then:

**Tool execution authorized**

Then transition to:

**EXECUTED SUCCESSFULLY**

Update the audit log automatically.

Show:

`Approved by: Security Admin`

`Timestamp: just now`

`Execution status: Success`

This interaction must feel like a real operational security workflow.

---

# 15. DEMO SCENARIO 3 — AUTO ALLOW

Create a third action:

User request:

**"Read 12 internal knowledge-base articles."**

Agent proposes:

`knowledgeBase.read(12)`

Risk:

# 12 / 100

Status:

**LOW**

Decision:

# AUTO ALLOWED

Show:

**Safe action automatically executed**

This screen is important because it proves AgentShield does NOT simply block everything.

Use a green state.

Show:

`Risk: 12`

`Policy: internal_read_allow`

`Human approval: Not required`

`Execution: Successful`

Include the message:

**Low-risk actions continue without unnecessary human friction.**

---

# 16. DECISION GRAPH / ARCHITECTURE VIEW

Create a visually impressive **Decision Graph** page.

Use a node-based visualization inspired by React Flow.

Nodes:

**User Request**

↓

**AI Agent**

↓

**Structured Tool Call**

↓

**AgentShield Interceptor**

↓

**Risk Engine**

↓

**Policy Engine**

↓

Three branches:

### ALLOW

→ Tool Execution

### APPROVAL

→ Human Approval
→ Tool Execution

### BLOCK

→ Execution Halted

↓

**Audit Log**

Also display:

**Recovery Metadata**

where applicable.

Use animated connection lines or node highlighting.

When the user clicks an action, visually highlight its route through the graph.

This page should be a major technical "wow" feature.

---

# 17. RISK ENGINE PAGE

Create a polished page called:

**Risk Engine**

Subtitle:

**Transparent, deterministic, factor-based risk assessment.**

Show the formula visually:

`Action Base Risk`
`+ Scope Modifier`
`+ Data Sensitivity Modifier`
`+ External Impact Modifier`
`+ Irreversibility Modifier`
`= Risk Score`

Use visual cards for each factor.

Include the four risk bands:

### LOW

`0–29`
Auto-Allow

### MEDIUM

`30–59`
Allow / Approval depending on policy

### HIGH

`60–79`
Require Approval

### CRITICAL

`80–100`
Block / Elevated Approval

Add a large note:

**The LLM can extract intent. It cannot set the risk score or final authorization decision.**

---

# 18. POLICY MANAGEMENT PAGE

Create a **Policy Center**.

Title:

**Security Policies**

Show realistic policy cards.

Example:

### bulk_delete_guard

Status: Active

Condition:
`delete + scope > 100`

Action:
**BLOCK**

---

### financial_threshold

Status: Active

Condition:
`financial_transaction + amount > ₹10,000`

Action:
**REQUIRE APPROVAL**

Approver:
`finance_admin`

---

### mass_email_guard

Status: Active

Condition:
`send_email + recipients > 500`

Action:
**REQUIRE APPROVAL**

Approver:
`marketing_admin`

---

### sensitive_export_guard

Status: Active

Condition:
`sensitive data + export`

Action:
**BLOCK**

Make this page look like a serious policy-management product.

---

# 19. AGENT MANAGEMENT PAGE

Create:

**Protected Agents**

Display agent cards/table.

Examples:

**CRM Cleanup Agent**
Status: Active
Tools: CRM
Risk level: High
Actions today: 1,284

**Sales Outreach Agent**
Status: Active
Tools: Email
Risk level: Medium
Actions today: 692

**DevOps Agent**
Status: Protected
Tools: Infrastructure
Risk level: Critical
Actions today: 213

Each agent should have:

* Permissions
* Allowed tools
* Risk configuration
* Recent activity
* Policy scope
* Kill switch

Include a prominent but professional:

**Pause Agent**

control.

---

# 20. AUDIT LOG PAGE

Create a detailed **Audit Log**.

This should look like an enterprise security event viewer.

Columns:

* Timestamp
* Agent
* Action
* Tool
* Risk
* Policy
* Decision
* Approver
* Execution
* Reversible

Example:

`10:42:18`
CRM Agent
deleteCustomers(147)
100
bulk_delete_guard
BLOCK
—
Prevented

`10:41:53`
Sales Agent
sendEmails(38)
58
external_email_review
APPROVED
Security Admin
Executed

`10:41:22`
Research Agent
readArticles(12)
12
internal_read_allow
ALLOW
—
Executed

Add filters:

* Agent
* Decision
* Risk
* Date
* Tool
* Policy

Add search.

---

# 21. RECOVERY / ROLLBACK PAGE

Create:

**Recovery Center**

Important: do NOT claim that every action can be rolled back.

Classify actions visually as:

### REVERSIBLE

Previous state captured

### PARTIALLY REVERSIBLE

Compensating action available

### IRREVERSIBLE

Prevention is the control

Show one example of a reversible action:

**Customer status update**

Previous state:
`status = active`

New state:
`status = inactive`

Recovery:

**Restore Previous State**

Also show:

**AgentShield does not promise universal rollback. Irreversible external actions must be prevented before execution.**

This honesty should make the product feel more technically credible.

---

# 22. SECURITY / THREAT VIEW

Create a page called:

**Threat Protection**

Show threats and AgentShield defenses.

Examples:

**Prompt Injection**
→ Authorization independent of LLM reasoning

**Tool Misuse**
→ Tool + operation permission checks

**Excessive Permissions**
→ Least-privilege agent identities

**Sensitive Data Export**
→ Block-by-default policy

**Credential Abuse**
→ Scoped agent credentials

**Cascading Failures**
→ Agent/session controls + kill switch

Make this visually sophisticated, possibly using a security matrix.

---

# 23. MCP AWARENESS

Include MCP somewhere in the product as:

**MCP Ready**

Do NOT imply that a full MCP gateway has already been implemented.

Display:

`Agent → AgentShield → MCP → Tool`

Label it:

**Architecture-ready**

And:

**Native MCP gateway integration — roadmap**

This must remain technically honest.

---

# 24. GLOBAL INTERACTION DESIGN

Make the prototype genuinely interactive.

Buttons must work where appropriate.

Examples:

* Dashboard action → open action details
* Live action → open decision view
* Risk score → expand risk factors
* Policy → show matched rule
* BLOCK → update audit log
* APPROVAL → open approval queue
* APPROVE → change action state to Executed
* DENY → change action state to Denied
* Audit event → open detailed event drawer
* Agent → open agent detail
* Decision graph → highlight selected action path

Use realistic hover states, pressed states, loading states, success states and error states.

Use subtle micro-interactions.

Avoid unnecessary animation that would distract judges.

---

# 25. HACKATHON PRESENTATION MODE

Create a special **Demo Mode** / **Live Demo** entry in the navigation.

When opened, it should provide a clean staged experience for judges.

Header:

**AgentShield Live Demo**

Subheader:

**Watch an AI agent request. Watch AgentShield decide.**

Include three large scenario cards:

### 01 — BLOCK

Delete 147 CRM customers

Risk:
**100 / 100**

Decision:
**BLOCK**

### 02 — APPROVE

Send follow-ups to 38 leads

Risk:
**58 / 100**

Decision:
**REQUIRE APPROVAL**

### 03 — ALLOW

Read 12 internal knowledge articles

Risk:
**12 / 100**

Decision:
**AUTO-ALLOW**

Make these scenarios clickable.

The transition from scenario → interception → risk → policy → decision should be extremely smooth.

---

# 26. DEMO ORDER

Design the prototype specifically around this judge demo flow:

### Scene 1

Agent performing harmless read action.

### Scene 2

Agent attempts:

**Delete 147 customers**

### Scene 3

AgentShield intercepts.

### Scene 4

Risk score becomes:

**100 / 100 — CRITICAL**

### Scene 5

Risk factors appear.

### Scene 6

Policy:

`bulk_delete_guard`

fires.

### Scene 7

Final state:

# BLOCKED

**Zero customers deleted.**

### Scene 8

Open audit event.

### Scene 9

Run:

**Send follow-ups to 38 leads**

### Scene 10

Risk:

**58 / 100**

### Scene 11

Real-time approval request appears.

### Scene 12

Click APPROVE.

### Scene 13

Action executes.

### Scene 14

Show audit record.

### Scene 15

Finish with:

**"This is the layer that decides — not the agent."**

The prototype should make this sequence feel extremely smooth and presentation-ready.

---

# 27. FIRST SCREEN / LANDING MOMENT

The first screen the judges see should immediately communicate the product.

Create a strong hero dashboard header:

**AGENTSHIELD**

**Giving AI agents power without giving them unchecked authority.**

Supporting text:

**Every tool call is intercepted, risk-scored, policy-checked and resolved before execution.**

Then show a visual:

**AI AGENT**
→
**AGENTSHIELD**
→
**REAL WORLD TOOLS**

Under it:

**ALLOW • APPROVE • BLOCK**

This should be visually memorable.

---

# 28. DESIGN FOR JUDGES

Optimize every screen for someone who may have only **10–20 seconds to understand it**.

The prototype should communicate visually before requiring the presenter to explain it.

Use:

* Big meaningful headings
* Very clear decision states
* Short labels
* Strong hierarchy
* Realistic data
* Visual cause-and-effect
* Minimal text
* Clear security terminology

Do NOT fill screens with paragraphs.

The judge should never wonder:

**"What am I looking at?"**

---

# 29. TECHNICAL CREDIBILITY

Use technically accurate terminology from the AgentShield architecture:

* Tool-call interception
* Deterministic risk scoring
* Factor-based scoring
* Policy engine
* Human-in-the-loop approval
* Structured audit trail
* Least privilege
* Deny-by-default
* Scoped agent identity
* Reversible / partially reversible / irreversible
* Recovery metadata
* LLM-independent authorization
* MCP-aware architecture

Do NOT describe AgentShield as:

* "an AI that decides whether AI is safe"
* "a model that predicts danger"
* "100% secure"
* "guaranteed protection"
* "can undo anything"

The risk score must be presented as deterministic and explainable rather than AI-generated.

---

# 30. TECH STACK SECTION

Create a lightweight technical architecture/technology page.

Show only the technologies relevant to the actual MVP:

**Frontend**
React + Tailwind CSS

**Visualization**
React Flow

**Real-time**
Socket.IO

**Backend**
Node.js + Express

**Database**
PostgreSQL + Prisma

**AI**
One LLM provider using structured outputs / tool calling

**Authentication**
JWT

Use clean technical cards rather than a giant wall of logos.

---

# 31. RESPONSIVENESS

Primary target:

**Desktop 1440px wide**

Make the layout polished at desktop dimensions.

Also make it reasonably responsive for smaller screens.

The primary use case is a laptop/projector during a hackathon presentation, so prioritize desktop visual clarity.

---

# 32. COMPONENT SYSTEM

Create a consistent reusable design system.

Components should include:

* Buttons
* Status badges
* Risk badges
* KPI cards
* Tables
* Tabs
* Sidebars
* Modals
* Drawers
* Tooltips
* Alerts
* Toast notifications
* Risk meters
* Decision cards
* Policy cards
* Agent cards
* Activity rows
* Timeline entries
* Graph nodes

Keep spacing, border radius, iconography and typography consistent everywhere.

---

# 33. ICONOGRAPHY

Use clean professional icons representing:

* Shield
* AI agent
* Database
* Email
* Payment
* Cloud/infrastructure
* Lock
* Warning
* Block
* Check
* Human approval
* Audit
* Recovery
* Policy
* Risk
* MCP

Do not use cartoonish icons.

---

# 34. EMPTY / LOADING / SUCCESS STATES

Include polished states for:

* Loading risk analysis
* Waiting for approval
* Action blocked
* Action allowed
* Action approved
* Action denied
* Action executed
* No audit events
* No pending approvals

This helps the prototype feel like a real application.

---

# 35. IMPORTANT PRODUCT DIFFERENTIATORS TO VISUALIZE

The visual design should reinforce these specific differentiators:

### 1. Decision-time explainability

The human sees exactly WHY an action received its score.

### 2. Unified risk + policy + approval

Risk, policy and human control happen in one flow.

### 3. LLM-independent authorization

The agent can propose an action, but cannot authorize itself.

### 4. Recovery-aware design

The system tracks reversibility rather than falsely promising universal rollback.

### 5. Developer-first tool-agnostic interception

AgentShield sits at the tool-call boundary regardless of whether the downstream integration is direct API or MCP.

---

# 36. PREMIUM VISUAL DETAILS

Add subtle details that make this feel like a real product:

* Live "system operational" indicator
* "Last event received: 1.2s ago"
* Small latency indicator
* Agent status pulse
* Real-time event timestamps
* Security posture summary
* Policy evaluation time
* Risk calculation time
* Decision latency
* Environment indicator
* Production badge
* Tool connection status
* Approval expiry timer
* Audit integrity indicator

These should be secondary details, not clutter.

---

# 37. DO NOT OVERDESIGN

Do not make every part glow.

Do not make every card animated.

Do not use giant 3D shields.

Do not use generic "AI brain" visuals.

Do not add unnecessary pages like:

* Social feed
* Generic profile page
* Generic onboarding
* Marketing blog
* Fake chat page
* Generic analytics unrelated to security decisions

Every screen must support the core AgentShield story.

---

# 38. FINAL EXPERIENCE

The complete prototype should feel like:

**"An enterprise security control plane for autonomous AI agents."**

It should combine:

**Cybersecurity**
+
**AI infrastructure**
+
**Developer tooling**
+
**Enterprise governance**

The visual experience should leave judges with three memorable ideas:

### 1.

**The agent is not trusted.**

### 2.

**Every action is evaluated before execution.**

### 3.

**The decision is explainable: ALLOW, APPROVE or BLOCK.**

The strongest visual moment should be:

**AI Agent → Delete 147 Customers → AgentShield Intercepts → 100/100 CRITICAL → bulk_delete_guard → BLOCKED → Zero Records Deleted**

The second strongest should be:

**AI Agent → Send 38 Emails → 58/100 → Human Approval → APPROVE → Executed → Audit Logged**

And the third should be:

**AI Agent → Read 12 Articles → 12/100 → AUTO-ALLOW**

The contrast between these three scenarios is essential.

---

# 39. FINAL QUALITY BAR

Before finishing, review the entire prototype as if you are a hackathon judge.

Ask:

* Does the product immediately make sense?
* Does the UI look like a serious enterprise product?
* Can I understand the core idea without reading a paragraph?
* Is the security boundary visually obvious?
* Is the risk score easy to understand?
* Is the policy decision obvious?
* Is the human approval experience compelling?
* Does the BLOCK scenario feel impactful?
* Does the ALLOW scenario prove the product does not simply block everything?
* Does the audit trail demonstrate accountability?
* Does the architecture look technically credible?
* Are the interactions smooth?
* Is the UI consistent?
* Does anything look like a generic AI-generated template?
* Would this look impressive when projected on a large screen in front of judges?

If anything looks generic, cluttered, amateurish or visually inconsistent, refine it before considering the prototype complete.

### FINAL DESIGN GOAL

**Make AgentShield look like a product that already has a security team, enterprise customers and a production roadmap — while remaining honest about what is MVP, what is architecture-ready, and what is future scope.**

The final impression should be:

> **"AI agents are becoming powerful enough to act. AgentShield is the control layer that makes those actions accountable."**

Build the prototype with **strong visual storytelling, premium UI, realistic interactions, and a polished hackathon-demo flow**, not merely a collection of static screens.
