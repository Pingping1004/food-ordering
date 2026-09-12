# PromptServe — IDEA

> Strategic source of truth for Hermes.
>
> Last updated: 2026-09-12

---

## 1. One-Sentence Idea

**PromptServe is digital infrastructure for school and university cafeterias that changes food ordering from a physical queue into an advance-order workflow: students order ahead, restaurants prepare according to an organized queue, and students pick up when their food is ready.**

The long-term ambition is not merely to become a food-ordering app, but to become the **digital operating layer for institutional cafeterias**.

---

## 2. Core Problem

Traditional cafeterias rely heavily on a physical ordering process:

**Student → stand in queue → place order → restaurant prepares → wait → receive food**

This creates several problems:

### Students
- Spend part of their limited lunch break waiting in queues.
- Experience congestion during peak periods.
- Cannot easily order before reaching the cafeteria.
- May not know how long an order will take.

### Restaurants / Cookers
- Receive orders one customer at a time.
- Must manually remember and prioritize orders.
- Experience unpredictable demand during peak periods.
- Can make mistakes with orders or payments.
- May be reluctant to adopt software that adds additional work.

### Schools / Universities
- Operate or provide the cafeteria environment but generally do not directly operate each restaurant.
- Need to maintain a satisfactory student environment.
- May have limited reason to optimize individual restaurant sales.
- Under concession systems, restaurant sales may not directly affect the institution's revenue.

---

## 3. Key Product Insight

The core insight is:

> **Do not force restaurants to become sophisticated digital operators. Digitize the ordering layer while keeping the existing cooking workflow as simple as possible.**

PromptServe should therefore minimize additional work for restaurants.

The ideal restaurant workflow is:

**Order arrives → restaurant confirms → order enters production queue → restaurant prepares → student picks up**

The software should support the cook rather than require the cook to constantly interact with a complicated application.

---

## 4. Stakeholders

### Students

Primary value:

> **Order ahead → reduce queue/waiting → pick up when ready**

Potential benefits:
- Less time spent standing in line.
- More predictable ordering experience.
- Better use of lunch time.
- Ability to order before physically reaching the restaurant.

### Restaurants / Cookers

Primary value:

> **Receive orders in advance → organize production → reduce ordering/payment mistakes**

Potential benefits:
- Advance visibility of demand.
- Organized production queue.
- Payment verification.
- Fewer missed or misunderstood orders.
- Order/payment amount matching.
- Sales and order records.

### School / University

Primary value:

> **Provide better cafeteria infrastructure and student service without becoming the operator of each restaurant.**

Potential benefits:
- Better cafeteria experience.
- Potentially less physical congestion during peak periods.
- Digital ordering infrastructure for students and vendors.
- A modern service layer across independently operated restaurants.
- Potential operational visibility.
- Ability to develop evidence-based cafeteria management later.

Important:

**The school does not necessarily need detailed vendor sales data.**

Under a fixed-rent concession model, the institution may receive the same concession payment regardless of restaurant sales.

Therefore:

> Vendor sales analytics are a secondary capability, not the core reason for the school to buy PromptServe.

---

## 5. Strategic Thesis: School as Infrastructure Customer

The strongest current business thesis is:

> **The school may be willing to provide or purchase PromptServe as digital cafeteria infrastructure because the cafeteria is part of the institution's student environment, even if the school does not directly profit from restaurant sales.**

This is analogous to other institutional infrastructure such as:
- Wi-Fi
- campus information systems
- transportation systems
- physical cafeteria facilities
- student-service infrastructure

The school does not necessarily need to earn money from every transaction.

The value proposition can instead be:

> **The institution provides a better cafeteria service to students and vendors by providing the digital infrastructure that connects them.**

This thesis is a hypothesis and must be validated through conversations with actual school decision-makers.

---

## 6. Concession-System Insight

Research suggests that many schools in Thailand operate cafeteria restaurants through concession systems where vendors compete/bid for annual rental rights and pay a fixed rent.

If this model applies:

**School revenue ≈ fixed concession/rental amount**

rather than:

**School revenue ≈ percentage of restaurant sales**

This creates an important strategic implication:

### Weak school pitch

> "PromptServe helps restaurants sell more food."

The school may reasonably ask:

> "Why does that matter to us?"

### Stronger school pitch

> "PromptServe gives the school digital infrastructure that improves the cafeteria experience for students and makes ordering easier for existing restaurants."

The school should therefore be approached primarily as an **institutional infrastructure/service customer**, not as a restaurant-sales beneficiary.

This is a working thesis, not a universal fact about every Thai school. Each target institution's actual concession and cafeteria-management model should be verified.

---

## 7. Product Positioning

### Preferred positioning

> **PromptServe is a digital cafeteria infrastructure system for schools and universities.**

Alternative explanation:

> PromptServe changes cafeteria ordering from physical queues to advance digital orders while allowing restaurants to continue using a simple cooking workflow.

### Avoid positioning primarily as

- Food delivery app
- Restaurant marketplace
- Consumer ordering app
- AI food-ordering platform
- Restaurant sales-growth tool
- Analytics dashboard

These descriptions either weaken the institutional value proposition or focus attention on secondary features.

---

## 8. Stakeholder Value Hierarchy

### School pitch

1. Better cafeteria infrastructure
2. Better student experience
3. Potentially less lunchtime congestion
4. Easier ordering for restaurants
5. Operational visibility/data as a secondary capability

### Restaurant pitch

1. Advance orders
2. Organized production queue
3. Payment verification
4. Reduced order/payment mistakes
5. Sales/order records

### Student pitch

1. Order ahead
2. Less queue/waiting
3. More lunch time
4. Convenient pickup

---

## 9. Product Workflow

### Current conceptual workflow

**Student**

Browse restaurant  
↓  
Select menu  
↓  
Place order  
↓  
Payment / payment verification  
↓  
Wait for restaurant confirmation  
↓  
Restaurant prepares  
↓  
Student receives pickup status  
↓  
Student picks up food

### Restaurant

New order  
↓  
Accept / confirm  
↓  
Order enters production queue  
↓  
Prepare food  
↓  
Mark completed  
↓  
Student pickup

### Institutional layer

School  
↓  
Provides cafeteria environment  
↓  
PromptServe provides digital ordering infrastructure  
↓  
Restaurants operate through the system  
↓  
Students use the system

---

## 10. Current Product Scope

Current technology/product direction includes:

### Customer
- Restaurant browsing
- Menu browsing
- Food ordering
- Payment flow
- Order tracking
- Pickup workflow

### Restaurant
- Order receiving
- Order status management
- Cooking/production queue
- Payment-slip verification
- Order records
- Sales information

### Platform
- Polling-based order/status updates
- PWA/mobile-friendly experience
- Cloud deployment
- Monitoring/error tracking
- Database-backed order persistence

### Potential future capabilities
- School executive dashboard
- Restaurant/vendor management
- Menu management
- Operating hours
- Pickup-slot capacity
- QR pickup
- Notifications
- Refund workflow
- Complaint management
- Cafeteria operational analytics

Future capabilities must not automatically be treated as current product features.

---

## 11. Pilot Strategy

The immediate objective is to prove that PromptServe works in a real cafeteria environment.

### Pilot model

Offer the school a:

> **1-month free trial**

with the objective of allowing:
- students to use the system,
- restaurants to operate through it,
- the school to observe the results,
- PromptServe to collect feedback,
- PromptServe to adjust the system to the school's environment.

The pilot should be positioned as:

> **A controlled real-world experiment before making a long-term decision.**

The goal is not simply to generate many orders.

The goal is to prove:

1. Students will actually use it.
2. Restaurants can operate it without unacceptable additional workload.
3. Orders/payment/statuses are reliable.
4. The workflow works during peak periods.
5. The school sees meaningful value.
6. The value is strong enough to justify continued deployment.

---

## 12. Pilot KPIs

### Demand
- Total orders
- Orders per day
- Orders by time period
- Number of participating restaurants

### Operational reliability
- Successful order rate
- Duplicate-order rate
- Missing-order rate
- Restaurant acceptance time
- Preparation delay rate
- Cancellation rate
- Payment verification accuracy
- System errors
- Availability/uptime

### User value
- Student feedback
- Restaurant feedback
- School/admin feedback
- Reported waiting-time improvement
- Reported cafeteria congestion improvement

Do not claim a reduction in waiting time, restaurant revenue growth, or other quantitative benefits unless they are actually measured.

---

## 13. Evidence Discipline

Hermes must distinguish between:

### FACT
Directly observed, measured, documented, or explicitly confirmed by a stakeholder.

### HYPOTHESIS
A reasonable business/product belief that has not yet been sufficiently validated.

### ASSUMPTION
Something currently believed to be true but requiring verification.

Never convert hypotheses into facts.

Never invent:
- order numbers
- revenue increases
- queue reductions
- customer satisfaction
- restaurant testimonials
- school endorsements
- adoption rates

When presenting PromptServe externally, use placeholders such as:

- `[X orders]`
- `[X participating restaurants]`
- `[X% successful orders]`
- `[X min average waiting time]`

until real measurements exist.

---

## 14. Current Business Model Hypotheses

### Primary hypothesis

**School/university pays PromptServe as digital cafeteria infrastructure.**

Potential structure:
- Free pilot
- Long-term SaaS/service contract
- Institution pays for system operation and support

### Secondary hypothesis

Restaurants may eventually pay for:
- advanced restaurant tools
- premium analytics
- payment services
- operational features

However, this should not be assumed before validating willingness to pay.

### Important pricing principle

Do not anchor the business around a high annual price before proving institutional value.

A previously considered target of approximately **500,000 THB/year** is a business hypothesis, not validated willingness to pay.

Before pursuing that price, establish:
- What institutional problem PromptServe solves.
- How important that problem is.
- Who owns the budget.
- What alternatives exist.
- What the institution currently spends.
- What measurable value PromptServe creates.
- Whether the institution sees cafeteria infrastructure as a budget-worthy service.

---

## 15. School Sales Strategy

The first school meeting should not primarily be a software sales presentation.

The objective should be:

> **Validate whether the school considers improving cafeteria infrastructure and student cafeteria experience valuable enough to support a digital system.**

Recommended narrative:

### 1. Problem

Students spend significant time waiting in physical cafeteria queues.

### 2. Insight

The bottleneck is partly the ordering process, not simply food preparation.

### 3. Solution

Change:

**physical queue → advance digital order**

### 4. Restaurant benefit

Restaurants receive orders in advance and can prepare according to an organized queue without fundamentally changing their cooking process.

### 5. Student benefit

Students can order before reaching the restaurant and pick up when ready.

### 6. Institutional benefit

The school can provide digital cafeteria infrastructure that improves the student/vendor experience without becoming the operator of individual restaurants.

### 7. Trial

Offer a controlled free pilot.

### 8. Measurement

Measure actual demand, reliability, restaurant feasibility, and student/school feedback.

### 9. Long-term decision

Only after evidence should the school decide whether continued deployment is valuable.

---

## 16. What the School Probably Does NOT Need

Do not assume that a school needs:
- Detailed restaurant revenue analytics
- Deep vendor-level sales intelligence
- Complex AI
- A complicated executive dashboard
- A sophisticated restaurant ERP
- A new payment wallet
- Major changes to restaurant operations

These may become useful later, but they should not drive product development without evidence of demand.

The central question is:

> **What does the school actually care about enough to allocate budget or institutional support toward?**

---

## 17. Critical Validation Questions

Hermes should help continuously investigate these questions:

### School buyer
- Who actually makes the decision?
- Director?
- School owner/licensee?
- Cafeteria manager?
- Procurement?
- Student affairs?
- Facilities?
- IT?

### Institutional value
- Does the school consider cafeteria service part of student welfare/service quality?
- Does the school actively care about lunchtime congestion?
- Does the school receive complaints about cafeteria queues?
- Does the school currently provide digital infrastructure to vendors?
- Would the school pay for a system that primarily benefits students and vendors?

### Concession structure
- Does the target school use fixed-rent concession?
- Does the school receive a percentage of sales?
- Who owns/operates the cafeteria?
- Who selects vendors?
- Who is responsible for student complaints?

### Adoption
- Will restaurants accept advance orders?
- Will restaurants consider PromptServe additional work?
- Will students actually order ahead?
- How much incentive is required?
- Does usage remain after incentives disappear?

### Economics
- Who has the budget?
- What budget category would PromptServe belong to?
- What alternative does the school have?
- Could the school build the system internally?
- What would make outsourcing preferable to internal development?

---

## 18. Competitive / Strategic Threat

A school or university may believe:

> "We can have our own students build this as a project."

This is a legitimate threat.

PromptServe therefore should not compete purely on:

- source code
- UI
- basic ordering functionality

The defensible offering should increasingly become:

> **Production infrastructure + deployment + maintenance + monitoring + support + vendor onboarding + operational knowledge + continuous improvement + accumulated cafeteria data/workflows.**

The product should become difficult to replace because of the **service and operating capability**, not because the code is secret.

---

## 19. Current Strategic Risk

The biggest risk is not technical.

It is:

> **Payer-beneficiary misalignment.**

Students benefit directly.

Restaurants benefit directly.

The school pays.

Therefore PromptServe must prove why the school should care enough to fund the infrastructure.

The school does not need to benefit financially from restaurant sales for the model to work, but it must perceive enough institutional value in:
- student experience,
- cafeteria service,
- infrastructure,
- operational quality,
- or another real institutional priority.

This is currently a key business hypothesis.

---

## 20. Product Development Principle

Do not build features merely because they sound valuable.

Use:

**Problem → Evidence → Prototype → Pilot → Measure → Learn → Build**

not:

**Idea → Feature → Feature → Feature**

For school-facing features, prioritize based on actual conversations and pilot evidence.

---

## 21. Near-Term Priorities

### Priority 1 — Reliability
Ensure:
- orders cannot disappear
- duplicate orders are prevented
- payment/order state is recoverable
- polling is reliable
- backend failures are recoverable
- restaurant workflow remains stable

### Priority 2 — Real-world testing
Test:
- concurrent customers
- burst orders
- network failures
- backend restart
- frontend restart
- browser close/reopen
- payment edge cases
- refresh/navigation edge cases

### Priority 3 — Measurement
Collect reliable:
- order data
- timing data
- delay/cancellation data
- error data
- feedback

### Priority 4 — Pilot acquisition
Approach schools and cafeteria stakeholders.

### Priority 5 — Learn institutional pain
Do not assume the school's problem.

Ask.

### Priority 6 — Build institutional features
Only after identifying what the school actually values.

---

## 22. Guiding Principle for Hermes

When reasoning about PromptServe, Hermes should repeatedly ask:

> **Who benefits? Who pays? Why would the payer care?**

Then:

> **What evidence proves that?**

And:

> **What is still only a hypothesis?**

Avoid optimizing for vanity metrics such as total orders if they do not demonstrate real product value.

The ultimate goal is not:

> "Build a food ordering app."

It is:

> **Prove that PromptServe can become valuable digital infrastructure for institutional cafeterias, then build the business and product around the value that institutions are actually willing to pay for.**

---

## 23. Current Core Thesis

**PromptServe should be treated as a potential B2B2C cafeteria infrastructure company.**

**B2B:** School/university is the institutional customer.

**B2C:** Students are the end users.

**Vendor network:** Restaurants/cookers are operational participants.

The school provides the environment.

PromptServe provides the digital infrastructure.

Restaurants provide the food.

Students create demand.

The system connects the three.

The thesis is promising but **not yet validated at scale**.

The next objective is therefore not to assume the thesis is correct.

The next objective is to **validate it through real school conversations and real cafeteria pilots.**

