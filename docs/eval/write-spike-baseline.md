# Write-Spike Baseline Behavior (RED Phase)

Date: 2026-04-09
Method: Each scenario analyzed as a naive agent with ONLY the raw prompt -- no `/write-spike` skill, no spike template, no interview protocol loaded. The agent has access to Jira (Atlassian Rovo MCP), Slack MCP, Hindsight, and normal tools.

Real data was fetched to ground the analysis: MES-3899 is a real ticket with 10 spike goals, 3 cross-team dependencies, 2 comments (AB Khalid, Florent Traisnel), and a rich Slack channel (C0APSFH0LJ3) with architectural analysis from James Webster about the contact identity model problem.

---

## Scenario 1: "Write a spike document for MES-3899"

### Agent Behavior Trace

**Step 1: Orientation**
The agent would recognize "MES-3899" as a Jira ticket and fetch it using the Atlassian Rovo MCP. This is the one step a capable agent reliably does -- it has a concrete identifier to resolve.

**Step 2: Jira Fetch (what the agent actually gets)**
The agent would successfully retrieve MES-3899 and find:
- Title: "[Spike] Assess impact of WhatsApp BSUID compliance across Aircall's messaging stack"
- 10 spike goals covering Twilio webhooks, messaging service, conversation service, Workspace, Dashboard, Admin Portal, CRM integrations, analytics, public API, and effort estimates
- 3 cross-team dependencies (Twilio, Integrations, Numbers)
- 2 comments from AB Khalid (Meta Contact Book Feature, username in webhook) and Florent Traisnel (breaking change analysis)
- Acceptance criteria, deadline, testing strategy
- Parent epic: MES-3136 (WhatsApp Public API)

**Step 3: What the agent WOULD do next**
The agent would immediately begin writing a spike document based solely on the Jira ticket content. It would restructure the ticket description into a markdown document, essentially paraphrasing what is already written. The output would look like a reorganized version of the ticket -- not an actual investigation.

**Step 4: What the agent would NOT do**
- Would NOT read the Slack channel for additional context (James's deep analysis of contact identity, AB Khalid's Twilio call notes)
- Would NOT search Hindsight for past spike learnings or related memories
- Would NOT explore any codebase to understand current implementation
- Would NOT classify knowledge gaps (Known / Can-Investigate / Need-Others)
- Would NOT create a private notes file
- Would NOT run grill-me
- Would NOT generate Mermaid diagrams
- Would NOT offer Confluence publishing

### Projected Output

The agent would produce a single markdown file that essentially mirrors the Jira ticket:

```markdown
# Spike: WhatsApp BSUID Compliance

## Background
[Paraphrase of ticket description]

## Goals
1. Twilio webhook payload
2. Messaging service
[... listing all 10 goals verbatim or lightly reworded]

## Dependencies
| Team | Contact | What we need |
[... copying the dependency table from the ticket]

## Recommendations
[Generic recommendations like "we should investigate further"]
```

### Evaluation Criteria

| Dimension | Result | Detail |
|-----------|--------|--------|
| Did it fetch the Jira ticket? | YES | This is the one thing it reliably does -- MES-3899 is a clear identifier. |
| Did it gather context from Slack? | NO | Did not read C0APSFH0LJ3. Missed James's analysis of the contact identity model problem, AB Khalid's Twilio call notes, and the linked MES-3908 ticket. |
| Did it gather context from Hindsight? | NO | Did not query for past spike learnings, messaging architecture knowledge, or BSUID-related memories. |
| Did it explore any codebase? | NO | Did not look at messaging-service, conversation-service, or Workspace code to understand current phone-number-based routing. |
| Did it classify knowledge gaps? | NO | Everything treated as equally unknown. No Known / Can-Investigate / Need-Others classification. |
| Did it produce a structured spike doc? | PARTIALLY | Produced a document, but it is a paraphrase of the ticket, not an investigation. No original analysis. |
| Did it include Mermaid diagrams? | NO | No architecture diagrams, no flow diagrams, no migration sequence diagrams. |
| Did it create a private notes file? | NO | No delegation guide, no contact confidence table, no personal action items. |
| Did it run grill-me? | NO | No stress-testing of the document. Blind spots remain unexamined. |
| Did it offer Confluence publishing? | NO | Output dumped as a local file or inline text. No publishing workflow. |
| Did it follow company patterns? | NO | No mention of zero-downtime migration patterns, backward-compatible schema changes, or existing contact resolution flows. |

### Rationalizations for Skipping Steps

1. **"The Jira ticket has all the context I need"** -- The ticket is comprehensive, so the agent treats it as sufficient. But the ticket is the QUESTION, not the ANSWER. The Slack channel has James's architectural analysis that goes deeper than the ticket itself (the contact identity model problem, the 3 realistic options for handling BSUID-only senders).

2. **"I don't know the Slack channel ID"** -- The prompt only says "MES-3899" with no Slack reference. The agent does not search for related Slack channels. Even if it knew the channel, it would likely skip it because "the ticket is detailed enough."

3. **"I'll write a comprehensive document"** -- The agent compensates for lack of investigation by being thorough in structure. It lists every goal, every dependency, every acceptance criterion -- but adds no original analysis because it did not actually investigate anything.

4. **"Spike documents summarize findings"** -- The agent conflates "writing a spike document" with "summarizing the ticket." A real spike involves active investigation, code exploration, and knowledge synthesis. The agent skips all of that.

5. **"I can always add more detail later"** -- Defers depth to an imaginary future iteration.

### Key Failure Modes

- **Paraphrase, not investigation**: The output reorganizes existing information rather than generating new understanding
- **Single-source**: Only Jira consulted. Slack, Hindsight, and codebase all ignored
- **No knowledge classification**: Cannot distinguish between what the engineer already knows, what they can find out, and what requires external input
- **No diagrams**: A cross-stack spike without architecture diagrams is incomplete by definition
- **No private notes**: The engineer gets a public document but no personal delegation guide or confidence assessment
- **No quality gate**: Document shipped without stress-testing (grill-me)
- **Missing Slack context**: James's analysis of the contact identity model (the deepest technical insight available) is never incorporated

---

## Scenario 2: "I need to investigate how adding real-time translation to our messaging pipeline would work. There's no ticket yet."

### Agent Behavior Trace

**Step 1: Orientation**
The agent has no ticket ID to resolve. It would try to understand the request from the free text alone. Without a concrete anchor, the agent's behavior becomes significantly more variable.

**Step 2: What the agent WOULD do**
The agent would likely do one of two things:
- **Option A (most likely)**: Write a generic investigation document immediately based on its general knowledge of messaging pipelines and translation services. No external tool usage at all.
- **Option B (less likely)**: Search for "real-time translation" or "messaging pipeline" in Jira/Slack to find related context, then write a document.

In either case, the output would be a generic technical design document, not a spike.

**Step 3: What the agent would NOT do**
- Would NOT search Slack for any prior discussions about translation in the messaging context
- Would NOT search Hindsight for related architecture memories
- Would NOT explore the messaging pipeline codebase to understand where translation would plug in
- Would NOT identify specific Aircall services affected (messaging-service, conversation-service, Workspace, etc.)
- Would NOT produce effort estimates (no basis for estimation without codebase understanding)
- Would NOT suggest creating a Jira ticket for tracking
- Would NOT produce phasing (discovery / prototype / implementation)
- Would NOT create a private notes file
- Would NOT run grill-me

### Projected Output

```markdown
# Investigation: Real-Time Translation in Messaging Pipeline

## Overview
Adding real-time translation to the messaging pipeline would allow messages
to be automatically translated between languages.

## Technical Approach
- Translation API integration (Google Translate, DeepL, or similar)
- Message interception at the pipeline level
- Language detection for incoming messages
- Translation before delivery to agents

## Considerations
- Latency impact
- Cost per translation
- Language pair support
- Accuracy for domain-specific terms
- User opt-in/opt-out

## Next Steps
- Evaluate translation providers
- Prototype with a single language pair
- Measure latency impact
```

### Evaluation Criteria

| Dimension | Result | Detail |
|-----------|--------|--------|
| Did it search for prior discussions? | NO | No Slack or Jira search for "translation" or "real-time translation." Prior discussions, if any, are lost. |
| Did it search Hindsight? | NO | No query for messaging architecture knowledge or translation-related memories. |
| Did it explore the codebase? | NO | No understanding of where in the pipeline translation would be inserted. No awareness of message flow, SQS consumers, or event schemas. |
| Did it identify affected services? | NO | Generic "messaging pipeline" reference. No mention of messaging-service, conversation-service, Workspace, data platform, or CRM integrations. |
| Did it produce effort estimates? | NO | No basis for estimation. Generic "next steps" instead. |
| Did it produce phasing? | NO | No discovery / prototype / implementation phases. Just a flat list of "considerations." |
| Did it produce a structured spike doc? | NO | Produced a generic technical design document. Missing: goals, current state, knowledge gaps, cross-team dependencies, testing strategy. |
| Did it include Mermaid diagrams? | NO | No architecture diagrams showing where translation fits in the message flow. |
| Did it create a private notes file? | NO | No delegation guide, no "who to talk to" list. |
| Did it suggest creating a Jira ticket? | NO | The investigation has no tracking anchor. |
| Did it run grill-me? | NO | No stress-testing. |
| Did it offer Confluence publishing? | NO | Output is a local file. |

### Rationalizations for Skipping Steps

1. **"There's no ticket, so there's nothing to fetch"** -- The absence of a ticket becomes an excuse to skip ALL context gathering, not just Jira. Slack, Hindsight, and codebase searches are independent of whether a ticket exists.

2. **"I know how translation pipelines work"** -- The agent's general knowledge of translation APIs substitutes for investigation of Aircall's specific messaging architecture. The output could apply to any company.

3. **"The user said 'investigate how it would work' -- that's a design question"** -- The agent interprets this as "write a technical design" rather than "produce a spike document." A spike has a specific structure (current state, gaps, effort, phasing, dependencies). A design document does not.

4. **"I'll keep it high-level since it's early stage"** -- The agent uses the lack of a ticket as justification for shallowness. But a spike IS the early-stage investigation -- it should go deep enough to produce actionable effort estimates.

5. **"Considerations cover the unknowns"** -- Listing "latency impact" and "cost per translation" as bullet points is not the same as classifying them as Known / Can-Investigate / Need-Others and planning how to resolve each.

### Key Failure Modes

- **Generic output**: The document reads like a ChatGPT response about translation, not an Aircall-specific investigation
- **No context gathering**: Zero external tool usage despite having Slack, Hindsight, and codebase access
- **Wrong document type**: Produces a "technical design" when asked for a "spike" -- different structure, different purpose
- **No effort estimation**: Without codebase understanding, effort estimates are impossible, so the agent skips them entirely
- **No phasing**: No acknowledgment that this needs to be broken into phases
- **No knowledge classification**: The agent cannot distinguish what it knows from what needs investigation
- **No ticket suggestion**: The investigation floats untethered -- no tracking, no ownership, no deadline

---

## Scenario 3: "Write a spike for MES-3899 about WhatsApp BSUID compliance across our entire messaging stack. It has 10 goals spanning 7 services, 3 external team dependencies, and database changes. The Slack channel is C0APSFH0LJ3."

### Agent Behavior Trace

**Step 1: Orientation**
The agent has the richest input: a ticket ID, a Slack channel ID, scope description, and explicit complexity signals (10 goals, 7 services, 3 dependencies, DB changes).

**Step 2: Jira Fetch**
Same as Scenario 1 -- the agent would successfully fetch MES-3899 with all its detail.

**Step 3: Slack Read (PARTIAL)**
This is where Scenario 3 diverges from Scenario 1. Because the Slack channel is explicitly provided, the agent would likely read it. It would find:
- James Webster's deep analysis of the contact identity model problem (lines vs contacts as identifiers, the 3 realistic options)
- AB Khalid's notes about Twilio calls and Meta Contact Book Feature
- Links to related tickets (MES-3904 through MES-3909, MES-3127, MES-3131)
- James's warning: "this spike looks like it's going to grow tendrils very quickly"

**Step 4: What the agent WOULD do**
The agent would combine Jira + Slack context and produce a longer, more detailed document than Scenario 1. But it would still be a reorganization of existing information, not an investigation. The agent would:
- List all 10 goals with some Slack context incorporated
- Include the dependency table from the ticket
- Reference James's analysis of the contact identity problem
- Maybe include some recommendations based on the 3 options James outlined

**Step 5: What the agent would NOT do**
- Would NOT do a scope check (should this be split into sub-spikes?)
- Would NOT search Hindsight for related memories
- Would NOT explore any codebase
- Would NOT classify knowledge gaps per goal
- Would NOT produce TWO output files (public spike + private notes)
- Would NOT run grill-me
- Would NOT generate Mermaid diagrams
- Would NOT follow company DB migration patterns
- Would NOT suggest phasing the 10 goals into priority tiers
- Would NOT produce a contact confidence table for the 3 external dependencies
- Would NOT offer Confluence publishing

### Projected Output

A single, long markdown document:

```markdown
# Spike: WhatsApp BSUID Compliance

## Background
[Paraphrase of ticket + Slack context about contact identity model]

## Scope
10 goals across 7 services with 3 external team dependencies and database changes.

## Goals
1. Twilio webhook payload -- BSUID is already being received...
2. Messaging service -- Schema changes needed for BSUID and username...
[... all 10 goals with some Slack context mixed in]

## Key Insight: Contact Identity Model
[Paraphrase of James's analysis about what a contact is when phone number
is no longer guaranteed, the 3 options]

## Dependencies
[Table from ticket]

## Database Changes
[Generic mention of schema changes without company-specific migration patterns]

## Recommendations
- Option 1: Extend contact model (recommended)
- Option 2: Treat BSUID-only as unresolvable (short-term bridge)
- Option 3: Implicit merge on phone number re-reveal (fragile)

## Effort Estimates
[Vague S/M/L guesses without codebase investigation]

## Next Steps
- Consult Twilio, Integrations, and Numbers teams
- Begin implementation based on findings
```

### Evaluation Criteria

| Dimension | Result | Detail |
|-----------|--------|--------|
| Did it fetch the Jira ticket? | YES | MES-3899 successfully retrieved with full detail. |
| Did it read the Slack channel? | YES (but shallow) | Read the channel because it was explicitly provided. But did not follow up on linked tickets (MES-3904-3909), did not search for related channels, did not read thread replies. |
| Did it search Hindsight? | NO | No query for past spike learnings, messaging architecture, or BSUID-related memories. |
| Did it explore any codebase? | NO | Did not look at messaging-service schema, conversation-service routing, Workspace contact display, or webhook handlers. Without this, effort estimates are guesses. |
| Did it do a scope check? | NO | Accepted 10 goals across 7 services as a single spike without questioning whether it should be split. James explicitly warned it would "grow tendrils" -- the agent would not act on this signal. |
| Did it classify knowledge gaps? | NO | All 10 goals treated equally. No distinction between goals the engineer can investigate alone (1, 2, 3) vs goals requiring external input (7, 9). |
| Did it produce a structured spike doc? | PARTIALLY | Better than Scenario 1 (has Slack context), but still a reorganization, not an investigation. No original analysis from codebase exploration. |
| Did it include Mermaid diagrams? | NO | A cross-stack spike touching 7 services with DB changes has zero diagrams. No architecture overview, no message flow, no migration sequence. |
| Did it create a private notes file? | NO | No delegation guide, no contact confidence table for Twilio/Integrations/Numbers contacts. No personal action items list. |
| Did it run grill-me? | NO | 10 goals, 3 external dependencies, DB migration -- shipped without any stress-testing. |
| Did it offer Confluence publishing? | NO | Output is a local file. The ticket's acceptance criteria explicitly say "Written output linked to this ticket." |
| Did it follow company DB migration patterns? | NO | Generic "schema changes needed" without zero-downtime migration strategy, backward compatibility considerations, or rollback plan. |
| Did it suggest phasing? | NO | All 10 goals presented as a flat list. No priority tiers (June deadline countries vs August global), no incremental delivery plan. |
| Did it produce a contact confidence table? | NO | 3 external dependencies with named contacts (AB Khalid for Twilio, Lauren/Bryan for Integrations, Brahim/Telma for Numbers) -- no confidence assessment of who is available, responsive, or blocking. |
| Did it follow up on Slack signals? | NO | James said "this spike looks like it's going to grow tendrils" and "owning the topic doesn't mean you have to do it all yourself" -- the agent would not incorporate these signals into scope management. |

### Rationalizations for Skipping Steps

1. **"I have both Jira and Slack context -- that's comprehensive enough"** -- Two sources feels like thorough research. But Hindsight, codebase exploration, and related channels are all missing. Two sources is not "comprehensive."

2. **"The ticket already has effort estimates (S/M/L)"** -- The ticket asks the spike TO PRODUCE effort estimates. The agent confuses the request with the answer. It would either skip estimates or produce generic S/M/L guesses without codebase investigation.

3. **"10 goals is a lot but I'll cover them all"** -- The agent treats breadth as thoroughness. Covering all 10 goals shallowly is worse than deeply investigating 3-4 and flagging the rest as needing more time. No scope management.

4. **"The dependency table tells me who to contact"** -- The ticket lists contacts, so the agent treats this as sufficient. But a private notes file would add: confidence level (have they responded?), availability (are they on leave?), alternative contacts, and escalation paths.

5. **"A single document is the standard format"** -- The agent does not consider that a spike of this complexity benefits from two outputs: a public document for the team and a private notes file for the engineer's own use (delegation guide, personal action items, confidence assessments).

6. **"Diagrams can be added later"** -- 7 services, DB changes, message routing changes -- this is exactly the kind of spike that needs architecture diagrams to be useful. Without them, readers must build the mental model from text alone.

### Key Failure Modes

- **No scope management**: 10 goals accepted without question. No sub-spike suggestion, no priority tiers, no "this is too big for one spike" flag
- **No codebase investigation**: Effort estimates are uninformed guesses
- **No knowledge classification**: Cannot distinguish goals the engineer owns vs goals blocked on external teams
- **Single output file**: No private notes, no delegation guide, no confidence table
- **No diagrams**: A 7-service cross-stack spike with zero visual aids
- **No grill-me**: The most complex scenario gets zero stress-testing
- **No company patterns**: DB migration mentioned generically, no zero-downtime strategy
- **No publishing workflow**: Ticket acceptance criteria say "written output linked to this ticket" but the agent does not offer to publish to Confluence or link back to Jira
- **Shallow Slack reading**: Channel read but signals not acted upon (James's "tendrils" warning ignored)

---

## Cross-Scenario Analysis

### Universal Failure Patterns

Every scenario exhibited the same fundamental failures:

1. **No multi-source context gathering**: At best, the agent fetches ONE source (Jira when given a ticket ID, or nothing when given free text). Parallel gathering from Jira + Slack + Hindsight + codebase never happens.

2. **No knowledge gap classification**: The agent does not distinguish between Known (the engineer already understands this), Can-Investigate (the engineer can find this out by exploring code/logs/docs), and Need-Others (blocked on external teams). Every goal is treated equally.

3. **No dual output**: 0/3 scenarios would produce two files. The public spike document and the private notes file (delegation guide, contact confidence table, personal action items) are always collapsed into one generic document.

4. **No diagrams**: 0/3 scenarios would include Mermaid diagrams. Even the cross-stack scenario touching 7 services would ship as pure text.

5. **No grill-me**: 0/3 scenarios would stress-test the output. The agent considers the document "done" once written.

6. **No publishing offer**: 0/3 scenarios would offer Confluence publishing or GitHub gist creation. Output is always a local file or inline text.

7. **No scope management**: The agent accepts whatever scope is given without questioning whether it is appropriate for a single spike.

8. **Paraphrase over investigation**: When context IS gathered (Jira ticket, Slack channel), the agent reorganizes existing information rather than generating new understanding through codebase exploration.

### The Core Rationalization Chain

```
"User asked me to write a spike"
  -> "I'll fetch the Jira ticket" (if ID given) or "I know the topic" (if free text)
    -> "I have enough context"
      -> "I'll write a comprehensive document"
        -> "Done. It covers all the goals."
```

Each step feels reasonable, but the chain skips:
- Gathering context from MULTIPLE sources in parallel (Slack, Hindsight, codebase)
- Classifying what is known vs unknown vs blocked (knowledge gaps)
- Producing TWO outputs (public spike + private notes)
- Visualizing the architecture (Mermaid diagrams)
- Stress-testing the document (grill-me)
- Offering publishing (Confluence, GitHub gist)
- Managing scope (is this too big for one spike?)
- Following company patterns (DB migrations, contact resolution flows)

### Failure Severity by Scenario

| Failure Mode | Scenario 1 (Ticket ID) | Scenario 2 (Free Text) | Scenario 3 (Full Context) |
|-------------|------------------------|------------------------|---------------------------|
| Context gathering | Jira only | Nothing | Jira + Slack (partial) |
| Knowledge classification | MISSING | MISSING | MISSING |
| Dual output | MISSING | MISSING | MISSING |
| Mermaid diagrams | MISSING | MISSING | MISSING |
| Grill-me | MISSING | MISSING | MISSING |
| Confluence offer | MISSING | MISSING | MISSING |
| Scope management | N/A (implicit) | N/A (vague) | MISSING (critical) |
| Codebase exploration | MISSING | MISSING | MISSING |
| Company patterns | MISSING | MISSING | MISSING |
| Effort estimates | Absent | Absent | Uninformed guesses |

### What `/write-spike` Must Address

Based on these baselines, the `/write-spike` skill must enforce:

1. **Mandatory multi-source gathering** -- Jira + Slack + Hindsight + codebase, in parallel. If any source is unavailable, explicitly state what was missed.

2. **Mandatory knowledge classification** -- Every goal/area must be classified as Known / Can-Investigate / Need-Others BEFORE writing begins. This drives the document structure and the private notes.

3. **Mandatory dual output** -- Two files always: public spike document (for the team) and private notes file (delegation guide, contact confidence table, personal action items, unknowns tracker).

4. **Mandatory Mermaid diagrams** -- At minimum: architecture overview showing affected services, message/data flow showing the change, and migration sequence if DB changes involved.

5. **Mandatory grill-me** -- Run grill-me on the completed spike document. Feed the output back into revision.

6. **Mandatory publishing offer** -- After document is finalized: offer Confluence page creation or secret GitHub gist, with option to link back to Jira ticket.

7. **Scope check for large spikes** -- If the spike has >5 goals or >3 services: suggest splitting into sub-spikes, get user confirmation before proceeding.

8. **Codebase-grounded effort estimates** -- Effort estimates must reference actual code (schema files, handler files, routing logic) not be abstract guesses.

9. **Company pattern enforcement** -- DB migrations must follow zero-downtime patterns. Contact resolution must follow existing flows. Schema changes must be backward-compatible.

10. **Interactive knowledge-building** -- Before writing, the agent should walk through the knowledge classification with the user: "For goal 1, I found X in the code. Is this accurate? What am I missing?"

### Baseline Quality Scores (Estimated)

| Dimension | Scenario 1 | Scenario 2 | Scenario 3 |
|-----------|-----------|-----------|-----------|
| Multi-source gathering | 20% (Jira only) | 0% (nothing) | 35% (Jira + partial Slack) |
| Knowledge classification | 0% | 0% | 0% |
| Dual output | 0% | 0% | 0% |
| Mermaid diagrams | 0% | 0% | 0% |
| Grill-me | 0% | 0% | 0% |
| Publishing offer | 0% | 0% | 0% |
| Scope management | N/A | N/A | 0% |
| Codebase exploration | 0% | 0% | 0% |
| Company patterns | 0% | 0% | 0% |
| Effort estimates | 0% | 0% | 10% (uninformed) |
| **Overall** | **~2%** | **~0%** | **~5%** |

These scores represent the GREEN phase target: any score above these baselines demonstrates the skill is adding value.

### The Specific Slack Context That Gets Lost

In Scenario 1 and Scenario 3, the Slack channel (C0APSFH0LJ3) contains critical context that an unguided agent misses or underutilizes:

1. **James Webster's contact identity analysis** -- "what is a contact at Aircall when a phone number is no longer guaranteed?" with 3 concrete options (extend contact model, treat as unresolvable, implicit merge). This is the deepest technical insight available and it is NOT in the Jira ticket.

2. **AB Khalid's Twilio call notes** -- "I am on call with Twilio and can pull them in for anything" + "suggesting to share a list of questions." This is live intelligence about dependency resolution.

3. **Meta Contact Book Feature** (from AB Khalid's Jira comment) -- "Meta is launching a contact book feature in early April 2026" that could change the BSUID calculus. The agent would not connect this comment to the broader investigation.

4. **James's scope warning** -- "this spike looks like it's going to grow tendrils very quickly. Owning the topic doesn't mean you have to do it all yourself. You can split and delegate." The agent would not act on this.

5. **Linked tickets** -- MES-3904 through MES-3909, MES-3127, MES-3131. The agent would not follow these links to understand the broader initiative.

All of this context is either missed entirely (Scenario 1 -- no Slack channel provided) or read but not acted upon (Scenario 3 -- signals acknowledged but not incorporated into scope management, delegation, or phasing).
