# Casebook

100 agent designs from real work, each written as a Halo file you can read top to bottom:

- **The system prompt.** It says who the agent serves, where its answers appear, what it can and can't see, and the reason behind each rule.
- **The tools.** The systems it reads from and acts on, as MCP servers named for the job (`Orders.lookup_order`, `Runbooks.run_runbook_action`), or Halo's built-in GitHub, Slack, SQL, Browser and Workspace tools.
- **Three tiers of action.** What it does freely, what waits for a person (`|! yield` before the call), and what it can never do (no method for it, a `Validate` on its answer, a gate, or a tool policy).
- **The design box** at the top of each file: users, surface, autonomy, risk, the trust boundary, what the file enforces in code (and what would live in the server instead), test cases to try, and a sample request.

The servers are fictional, so the files don't run against real systems. Read one with `halo plan`, which shows every call, its effect, where a person is asked, and the worst-case cost:

```bash
halo plan examples/casebook/021-ecommerce-refund.halo
```

`test/examples.test.ts` validates and runs every file with mocks.

## Software engineering

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 001 | [Pull request review bot](001-pr-review-bot.halo) | Autonomous | low |
| 002 | [Flaky test triager in CI](002-flaky-test-triager.halo) | Autonomous | medium |
| 003 | [On-call incident responder](003-oncall-incident-responder.halo) | Human in the loop | high |
| 004 | [Dependency upgrade agent](004-dependency-upgrade-agent.halo) | Autonomous | medium |
| 005 | [Database migration assistant](005-db-migration-assistant.halo) | Human in the loop | high |
| 006 | [Terraform change planner](006-terraform-change-planner.halo) | Assistive | high |
| 007 | [Release notes writer](007-release-notes-writer.halo) | Assistive | low |
| 008 | [Legacy framework migration agent](008-legacy-framework-migration.halo) | Human in the loop | medium |
| 009 | [Internal developer docs Q&A bot](009-developer-docs-bot.halo) | Assistive | low |
| 010 | [Stale feature-flag cleanup agent](010-stale-flag-cleanup.halo) | Autonomous | medium |

## Security and IT

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 011 | [SOC alert triage agent](011-soc-alert-triage.halo) | Autonomous | high |
| 012 | [Phishing report analyzer](012-phishing-report-analyzer.halo) | Autonomous | medium |
| 013 | [IT helpdesk access-request agent](013-it-access-requests.halo) | Human in the loop | high |
| 014 | [Vulnerability remediation prioritizer](014-vulnerability-prioritizer.halo) | Assistive | medium |
| 015 | [Cloud misconfiguration auditor](015-cloud-misconfig-auditor.halo) | Autonomous | medium |
| 016 | [Quarterly access review agent](016-quarterly-access-review.halo) | Human in the loop | high |
| 017 | [Laptop provisioning (MDM) agent](017-laptop-provisioning-mdm.halo) | Human in the loop | medium |
| 018 | [Leaked secret responder](018-leaked-secret-responder.halo) | Autonomous | high |
| 019 | [Pentest recon assistant (authorized engagement)](019-pentest-recon-assistant.halo) | Human in the loop | high |
| 020 | [Security questionnaire responder](020-security-questionnaire.halo) | Assistive | medium |

## Customer support

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 021 | [E-commerce refund agent](021-ecommerce-refund.halo) | Human in the loop | medium |
| 022 | [SaaS tier-1 technical support agent](022-saas-tier1-support.halo) | Human in the loop | medium |
| 023 | [Airline rebooking agent](023-airline-rebooking.halo) | Human in the loop | medium |
| 024 | [Telecom billing dispute agent](024-telecom-billing-dispute.halo) | Human in the loop | medium |
| 025 | [Bank lost-card and card-freeze agent](025-bank-card-freeze.halo) | Human in the loop | high |
| 026 | [Support ticket router](026-support-ticket-router.halo) | Autonomous | low |
| 027 | [Help-center article writer](027-help-article-writer.halo) | Assistive | low |
| 028 | [Dental clinic phone scheduling agent](028-dental-phone-scheduling.halo) | Human in the loop | medium |
| 029 | [Community forum moderator](029-forum-moderator.halo) | Autonomous | medium |
| 030 | [Subscription cancellation and retention agent](030-subscription-cancellation.halo) | Human in the loop | medium |

## Sales and marketing

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 031 | [Outbound sales email drafter](031-sales-email-drafter.halo) | Assistive | low |
| 032 | [CRM data hygiene agent](032-crm-data-hygiene.halo) | Autonomous | medium |
| 033 | [Inbound lead qualification chat](033-lead-qualification-chat.halo) | Human in the loop | low |
| 034 | [Paid ads budget optimizer](034-ads-budget-optimizer.halo) | Autonomous | high |
| 035 | [SEO content brief writer](035-seo-content-brief.halo) | Assistive | low |
| 036 | [Social media reply agent](036-social-media-reply.halo) | Human in the loop | medium |
| 037 | [Competitor intelligence monitor](037-competitor-monitor.halo) | Autonomous | low |
| 038 | [Sales call summarizer to CRM](038-sales-call-summarizer.halo) | Autonomous | medium |
| 039 | [Quote and pricing (CPQ) assistant](039-cpq-quote-assistant.halo) | Human in the loop | high |
| 040 | [Newsletter personalization agent](040-newsletter-personalization.halo) | Autonomous | medium |

## Finance

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 041 | [Accounts payable invoice processor](041-ap-invoice-processor.halo) | Autonomous | high |
| 042 | [Expense report auditor](042-expense-report-auditor.halo) | Assistive | medium |
| 043 | [Month-end reconciliation agent](043-month-end-reconciliation.halo) | Human in the loop | high |
| 044 | [Procurement purchase-request agent](044-procurement-purchase-request.halo) | Human in the loop | medium |
| 045 | [Collections and dunning agent](045-collections-dunning.halo) | Autonomous | medium |
| 046 | [Personal budgeting assistant](046-personal-budgeting-assistant.halo) | Assistive | low |
| 047 | [Public-filings research analyst](047-public-filings-analyst.halo) | Assistive | medium |
| 048 | [Personal tax document organizer](048-tax-document-organizer.halo) | Assistive | medium |
| 049 | [Card fraud alert review assistant](049-card-fraud-review.halo) | Assistive | high |
| 050 | [Treasury cash forecasting agent](050-treasury-cash-forecast.halo) | Autonomous | medium |

## Healthcare

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 051 | [Clinical documentation scribe](051-clinical-scribe.halo) | Assistive | high |
| 052 | [Patient intake and symptom triage chat](052-patient-intake-triage.halo) | Human in the loop | high |
| 053 | [Prior authorization agent](053-prior-authorization.halo) | Human in the loop | medium |
| 054 | [Medical coding suggester (ICD-10/CPT)](054-medical-coding-suggester.halo) | Assistive | medium |
| 055 | [Clinical trial matching agent](055-clinical-trial-matching.halo) | Assistive | medium |
| 056 | [Pharmacy refill assistant](056-pharmacy-refill-assistant.halo) | Human in the loop | medium |
| 057 | [Lab results explainer for patients](057-lab-results-explainer.halo) | Assistive | medium |
| 058 | [Biomedical literature review assistant](058-literature-review-assistant.halo) | Assistive | low |
| 059 | [Mental health journaling companion](059-journaling-companion.halo) | Assistive | high |
| 060 | [Hospital bed and discharge coordinator](060-bed-discharge-coordinator.halo) | Human in the loop | medium |

## Legal, HR and compliance

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 061 | [NDA review and redline agent](061-nda-redline.halo) | Assistive | medium |
| 062 | [Legal research memo assistant](062-legal-research-memo.halo) | Assistive | high |
| 063 | [E-discovery document reviewer](063-ediscovery-first-pass.halo) | Autonomous | high |
| 064 | [HR policy Q&A bot](064-hr-policy-bot.halo) | Assistive | medium |
| 065 | [Resume screening assistant](065-resume-screening.halo) | Assistive | high |
| 066 | [Interview scheduling agent](066-interview-scheduling.halo) | Human in the loop | low |
| 067 | [New-hire onboarding agent](067-onboarding-buddy.halo) | Human in the loop | medium |
| 068 | [Regulatory change monitor](068-regulatory-change-monitor.halo) | Autonomous | medium |
| 069 | [Privacy data-subject request (DSAR) handler](069-dsar-handler.halo) | Human in the loop | high |
| 070 | [Performance review drafting assistant](070-performance-review-drafter.halo) | Assistive | medium |

## Data and research

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 071 | [Text-to-SQL analytics agent](071-text-to-sql-analytics.halo) | Human in the loop | medium |
| 072 | [Metric anomaly explainer](072-metric-anomaly-explainer.halo) | Autonomous | low |
| 073 | [Data pipeline repair agent](073-pipeline-repair.halo) | Human in the loop | high |
| 074 | [Survey open-text coding agent](074-survey-coding.halo) | Autonomous | low |
| 075 | [Web research analyst](075-web-research-analyst.halo) | Assistive | medium |
| 076 | [Data labeling QA agent](076-labeling-qa.halo) | Autonomous | medium |
| 077 | [Spreadsheet cleanup agent](077-spreadsheet-cleanup.halo) | Human in the loop | low |
| 078 | [A/B test analysis reviewer](078-ab-test-reviewer.halo) | Assistive | medium |
| 079 | [Lab experiment planning assistant](079-lab-experiment-planner.halo) | Assistive | high |
| 080 | [Data catalog documentation agent](080-data-catalog-docs.halo) | Autonomous | low |

## Operations

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 081 | [Freight shipment exception handler](081-freight-exception-handler.halo) | Autonomous | medium |
| 082 | [Warehouse reorder agent](082-warehouse-reorder.halo) | Autonomous | medium |
| 083 | [Field service dispatcher](083-field-service-dispatch.halo) | Human in the loop | medium |
| 084 | [Manufacturing defect analysis agent](084-defect-analysis.halo) | Assistive | medium |
| 085 | [Restaurant phone ordering agent (voice)](085-phone-ordering-voice.halo) | Human in the loop | medium |
| 086 | [Property maintenance request agent](086-maintenance-requests.halo) | Human in the loop | medium |
| 087 | [Fleet maintenance scheduler](087-fleet-maintenance-scheduler.halo) | Autonomous | high |
| 088 | [Building HVAC energy optimizer](088-hvac-energy-optimizer.halo) | Autonomous | medium |
| 089 | [Corporate travel booking agent](089-corporate-travel-booking.halo) | Human in the loop | medium |
| 090 | [Public benefits application helper](090-benefits-application-helper.halo) | Assistive | high |

## Personal, education and media

| # | Case | Autonomy | Risk |
|---|---|---|---|
| 091 | [Personal email triage assistant](091-email-triage.halo) | Human in the loop | high |
| 092 | [Calendar scheduling assistant](092-calendar-scheduling.halo) | Human in the loop | low |
| 093 | [Children's math tutor](093-kids-math-tutor.halo) | Assistive | medium |
| 094 | [Language conversation partner](094-language-partner.halo) | Assistive | low |
| 095 | [University course TA bot](095-course-ta-bot.halo) | Assistive | medium |
| 096 | [Browser shopping agent](096-browser-shopping.halo) | Human in the loop | high |
| 097 | [Newsroom fact-checking assistant](097-newsroom-fact-check.halo) | Assistive | medium |
| 098 | [Video captioning and editing agent](098-video-captioning.halo) | Autonomous | low |
| 099 | [Smart home assistant](099-smart-home.halo) | Human in the loop | high |
| 100 | [Nonprofit grant writing assistant](100-grant-writing.halo) | Assistive | low |
