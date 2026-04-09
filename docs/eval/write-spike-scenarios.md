# Write-Spike Pressure Scenarios

These scenarios test whether an agent can produce high-quality spike documents WITHOUT dedicated `/write-spike` skill guidance. Each scenario targets specific failure modes that the skill must address.

## Scenario 1: Minimal Input (Just a Ticket ID)

**Prompt**: "Write a spike document for MES-3899"

**What this tests**:
- Does the agent fetch the Jira ticket to extract goals, scope, and context?
- Does it gather context from multiple sources (Slack, Hindsight, codebases) in parallel?
- Does it classify knowledge into Known / Can-Investigate / Need-Others?
- Does it produce a structured spike document with proper sections (goals, architecture, effort, risks, phasing)?
- Does it include Mermaid diagrams for architecture and flow?
- Does it create TWO output files (public spike doc + private notes)?
- Does it run grill-me to stress-test the document?
- Does it offer publishing options (Confluence, GitHub gist)?
- Does it follow company patterns for DB migrations, service interactions, etc.?

**Pressures**:
- No context provided beyond a ticket ID
- Agent must discover everything from Jira + related sources
- Risk of writing a shallow, generic document
- Risk of missing cross-team dependencies embedded in ticket comments

**Expected failure modes without guidance**:
- Skips context gathering entirely, produces a generic template
- Fetches Jira ticket but stops there -- does not explore Slack channels, Hindsight, or codebases
- No knowledge gap classification (everything treated as "known")
- Produces a flat document without diagrams or architecture analysis
- No private notes file with delegation guide or contact confidence table
- No grill-me stress test
- No publishing offer
- No company-specific patterns applied

## Scenario 2: No Jira Ticket (Free-Text Only)

**Prompt**: "I need to investigate how adding real-time translation to our messaging pipeline would work. There's no ticket yet."

**What this tests**:
- Can the agent handle unstructured input with no ticket to anchor on?
- Does it structure the investigation despite having no Jira goals to extract?
- Does it identify affected services by searching the codebase and Slack?
- Does it produce effort estimates and phasing even without explicit requirements?
- Does it create a ticket or suggest creating one?
- Does it search for prior art, existing discussions, or related initiatives?

**Pressures**:
- No structured input at all -- pure free text
- No ticket to extract goals, acceptance criteria, or linked issues from
- Vague scope ("how would it work" is open-ended)
- Agent must self-structure the investigation

**Expected failure modes without guidance**:
- Produces a generic "investigation plan" instead of a proper spike document
- Does not search Slack or Hindsight for prior discussions about real-time translation
- Does not identify which services in the messaging pipeline would be affected
- No effort estimates (treats it as a research question, not an engineering initiative)
- No phasing (doesn't break the work into discovery / prototype / implementation phases)
- No architectural analysis of how translation fits into the existing message flow
- Does not suggest creating a Jira ticket for tracking
- No Mermaid diagrams showing the proposed architecture
- No private notes identifying who to talk to or what's unknown

## Scenario 3: Large Cross-Stack Spike (Like BSUID)

**Prompt**: "Write a spike for MES-3899 about WhatsApp BSUID compliance across our entire messaging stack. It has 10 goals spanning 7 services, 3 external team dependencies, and database changes. The Slack channel is C0APSFH0LJ3."

**What this tests**:
- Does the agent do a scope check and recognize this is a large, cross-cutting initiative?
- Does it gather context from ALL sources in parallel (Jira + Slack channel + Hindsight + codebases)?
- Does it classify knowledge gaps (Known / Can-Investigate / Need-Others) for each goal?
- Does it produce TWO output files (public spike doc + private notes with delegation guide)?
- Does it run grill-me to stress-test the plan?
- Does it generate Mermaid diagrams showing cross-service interactions and migration paths?
- Does it follow company patterns for database migrations (e.g., zero-downtime, backward-compatible)?
- Does it identify the 3 external team dependencies and produce a contact confidence table?
- Does it suggest phasing or splitting the spike into sub-spikes?

**Pressures**:
- Massive scope: 10 goals across 7 services
- Cross-team complexity: 3 external dependencies the engineer cannot resolve alone
- Database migration concerns: schema changes require careful planning
- The Slack channel provides rich context that must be mined
- Risk of producing a document that is either too shallow (glosses over complexity) or too overwhelming (no prioritization)

**Expected failure modes without guidance**:
- Does not do a scope check -- dives straight into writing
- Fetches Jira but does not read the Slack channel for discussion context
- Does not search Hindsight for related past spikes or learnings
- Treats all 10 goals equally instead of classifying/prioritizing them
- No knowledge gap classification -- everything marked as "known" or skipped
- Does not produce a private notes file (delegation guide, contact confidence table)
- Does not run grill-me to find blind spots
- No Mermaid diagrams for the cross-service architecture
- Does not follow company DB migration patterns (assumes generic migration approach)
- Does not suggest splitting into sub-spikes despite the massive scope
- No effort estimates per goal/service
- Does not offer Confluence publishing or gist creation
