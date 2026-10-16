/**
 * Production-shaped retrieval fixture for the live Gemma 4 specs: a realistic
 * top-20 lookup result (long parent chunks, near-duplicates, off-topic tail)
 * over a fictional company handbook. Mirrors the shape and volume of a real
 * conversation turn without using any customer document.
 */

const DOC = {
  documentTitle: "Employee-Handbook-2026.pdf",
  documentId: "b7a3f1c2-8d4e-4a91-b2c5-6e7f8a9d0c1b",
  documentFileName: "Employee-Handbook-2026.pdf",
  documentSourceType: "project",
  modelName: "gemini-embedding-001",
}

export type HandbookChunk = typeof DOC & {
  chunkId: string
  chunkIndex: number
  distance: number
  isParentChunk: boolean
  content: string
}

function chunk(
  chunkId: string,
  chunkIndex: number,
  distance: number,
  isParentChunk: boolean,
  content: string,
): HandbookChunk {
  return { ...DOC, chunkId, chunkIndex, distance, isParentChunk, content }
}

/**
 * The alias ids of the chunks that actually answer the paid-leave question.
 * The fixture value is deliberately 27 days — NOT the French statutory 25 —
 * so a model cannot answer correctly from its training data: a correct
 * answer proves the retrieval actually grounded it.
 */
export const RELEVANT_CHUNK_IDS = ["c1", "c2"]

export const HANDBOOK_CHUNKS: HandbookChunk[] = [
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000001",
    42,
    0.21,
    true,
    "Full-time employees are entitled to 27 days of paid annual leave per calendar year, accrued monthly at a rate of 2.08 days. Unused leave can be carried over into the first quarter of the following year, up to a maximum of 5 days; any remaining balance is forfeited on April 1st.\nLeave requests must be submitted through the HR portal at least two weeks in advance for absences longer than three consecutive days. Managers approve requests based on team coverage; approval is not automatic during peak periods.\nEmployees who joined during the year accrue leave pro rata from their start date. During the probation period, employees accrue leave normally but are encouraged to limit long absences.\nPart-time employees accrue paid leave proportionally to their contractual working time. For example, an employee working 60% accrues 15 days per year.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000002",
    43,
    0.23,
    false,
    "In addition to paid annual leave, employees receive all public holidays observed in their country of employment. When a public holiday falls on a weekend, no compensatory day is granted unless required by local law.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000003",
    58,
    0.26,
    true,
    "Sick leave: employees unable to work due to illness must notify their manager before 10:00 on the first day of absence and provide a medical certificate for absences longer than three days. Sick leave is paid according to local statutory requirements plus the company top-up policy, which maintains full salary for up to 90 days per rolling year.\nRepeated short-term absences may trigger a well-being review with HR. The review is supportive in intent and aims to identify workplace adjustments.\nLong-term absences are handled case by case with the occupational health service. Return-to-work interviews are mandatory after any absence of ten days or more.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000004",
    61,
    0.27,
    false,
    "Parental leave follows local statutory entitlements. The company tops up statutory pay to 100% of base salary for the first 16 weeks of maternity or adoption leave and for the first 4 weeks of paternity leave.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000005",
    12,
    0.28,
    false,
    "Standard working hours are 39 hours per week, Monday to Friday. Core hours during which all employees must be available are 10:00 to 16:00 local time.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000006",
    14,
    0.29,
    true,
    "Remote work policy: employees may work remotely up to three days per week, subject to manager approval and team agreements. Fully remote arrangements require a written addendum to the employment contract and are reviewed annually.\nRemote workdays are not a substitute for care arrangements: employees are expected to be fully available during working hours. Equipment for the home office (laptop, monitor, headset) is provided by the company; a monthly stipend covers internet costs.\nEmployees working remotely from another country for more than 14 consecutive days must obtain prior approval from HR due to tax and social security implications.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000007",
    77,
    0.3,
    false,
    "Unpaid leave may be granted for personal projects or family circumstances after one year of tenure, for a duration of one to six months, subject to business needs.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000008",
    31,
    0.3,
    false,
    "Overtime must be approved in advance by the manager. Approved overtime is compensated in time off in lieu at a rate of 1.25, to be taken within three months.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000009",
    90,
    0.31,
    true,
    "Expense policy: business expenses are reimbursed when they are reasonable, necessary, and supported by receipts. Claims must be submitted within 30 days through the expense tool.\nTravel: economy class is the default for flights under six hours. Hotel bookings should not exceed the per-city caps published on the intranet. Meals during business trips are reimbursed up to the daily allowance; alcohol is not reimbursable.\nCommuting between home and the regular workplace is not a reimbursable expense. Mileage for approved car travel is reimbursed at the statutory rate.\nCorporate cards are issued to employees who travel more than four times per year. Personal use of the corporate card is prohibited and may lead to disciplinary action.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000010",
    8,
    0.31,
    false,
    "New joiners follow a two-week onboarding program covering tools, security training, and an introduction to each department. A buddy is assigned for the first three months.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000011",
    22,
    0.32,
    false,
    "The probation period is three months, renewable once. During probation, either party may terminate the contract with one week of notice.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000012",
    102,
    0.32,
    false,
    "Health insurance: all employees are enrolled in the group health plan from their first day. Dependents can be added during the annual enrollment window or after a qualifying life event.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000013",
    47,
    0.33,
    false,
    "Employees celebrating a work anniversary of five years receive one additional day of paid leave for that year, plus a recognition award chosen from the benefits catalog.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000014",
    115,
    0.33,
    true,
    "Performance reviews run twice a year, in June and December. The review covers goal achievement, competencies, and career development. Ratings feed into the annual compensation cycle in January.\nEmployees prepare a self-assessment; managers gather peer feedback from at least two colleagues. Calibration sessions across teams ensure consistency of ratings.\nPromotion cases are presented by managers during calibration. Promotion criteria per level are documented in the career framework on the intranet.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000015",
    130,
    0.34,
    false,
    "Referral bonus: employees who refer a candidate who is hired and completes probation receive a gross bonus of 1,500. Referrals for hard-to-fill roles listed on the intranet earn double.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000016",
    140,
    0.34,
    false,
    "Security training is mandatory for all employees and must be renewed every twelve months. Access to production systems is suspended for employees whose training has expired.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000017",
    151,
    0.35,
    false,
    "Resignation requires written notice. The notice period is one month for employees and three months for managers, unless the employment contract states otherwise.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000018",
    3,
    0.35,
    false,
    "This handbook applies to all employees and complements local employment law and individual employment contracts. Where local law is more favorable, local law prevails.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000019",
    160,
    0.36,
    false,
    "Company equipment must be returned on the last day of employment. IT deactivates accounts at the end of that day.",
  ),
  chunk(
    "11111111-aaaa-4bbb-8ccc-000000000020",
    95,
    0.36,
    false,
    "Lost or stolen equipment must be reported to IT security within 24 hours. Replacement devices are shipped within two business days.",
  ),
]

/**
 * What the lookup tool actually shows the model: short alias ids plus title
 * and content (see lookup-knowledge-base.tool.ts) — UUIDs stay server-side.
 */
export const MODEL_VISIBLE_CHUNKS = HANDBOOK_CHUNKS.map((handbookChunk, chunkIndex) => ({
  id: `c${chunkIndex + 1}`,
  documentTitle: handbookChunk.documentTitle,
  content: handbookChunk.content,
}))
