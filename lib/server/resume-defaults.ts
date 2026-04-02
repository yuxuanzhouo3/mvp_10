import { normalizeResumeContactInfo } from '@/lib/resume-contact'
import { estimateYearsExperienceFromResumeText } from '@/lib/server/resume-analysis'
import type {
  CandidateTask,
  CandidateTaskChannel,
  CandidateTaskKind,
  CandidateTaskStatus,
  CandidateTimelineActor,
  CandidateTimelineEvent,
  CandidateTimelineEventType,
  ResumeCommunication,
  ResumeContactInfo,
  ResumeInsight,
  ResumeRecord,
  ResumeWorkflow,
} from '@/types/resume'

type ResumeTaskSeed = Pick<ResumeRecord, 'contact' | 'workflow' | 'communication' | 'createdAt'>

function stageLabel(stage: string) {
  switch (stage) {
    case 'new':
      return '新候选人'
    case 'screening':
      return '筛选中'
    case 'interview':
      return '面试中'
    case 'offer':
      return 'Offer 阶段'
    case 'hired':
      return '已录用'
    case 'rejected':
      return '未通过'
    default:
      return stage
  }
}

function reviewStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return '待评审'
    case 'reviewed':
      return '已评审'
    default:
      return status
  }
}

function outreachStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return '待联系'
    case 'ready':
      return '可联系'
    case 'contacted':
      return '已联系'
    case 'responded':
      return '已回复'
    default:
      return status
  }
}

function taskStatusLabel(status: string) {
  switch (status) {
    case 'todo':
      return '待处理'
    case 'in_progress':
      return '进行中'
    case 'done':
      return '已完成'
    case 'blocked':
      return '受阻'
    default:
      return status
  }
}

function channelLabel(channel: string) {
  switch (channel) {
    case 'manual':
      return '手动'
    case 'email':
      return '邮件'
    case 'phone':
      return '电话'
    case 'assessment':
      return '测评'
    default:
      return channel
  }
}

function localizeCompositionName(name: string) {
  switch (name) {
    case 'Technical Skills':
      return '技术技能'
    case 'Experience':
      return '经验经历'
    case 'Education':
      return '教育背景'
    case 'Projects':
      return '项目实践'
    default:
      return name
  }
}

function localizeLegacySummary(summary: string) {
  const normalized = summary.trim()
  const legacyMatch = normalized.match(
    /^(.*?) resume parsed with (complete contact details|partial contact details), (about (\d+) years of experience|an unclear amount of experience), and key skills including (.*)\. Current readiness score is (\d+)\/100\.$/
  )

  if (!legacyMatch) {
    return normalized
  }

  const title = legacyMatch[1] === 'candidate' ? '候选人' : legacyMatch[1]
  const contactText = legacyMatch[2] === 'complete contact details' ? '联系方式较完整' : '联系方式仍需补充'
  const experienceText =
    legacyMatch[4] ? `约 ${legacyMatch[4]} 年工作经验` : '工作年限暂未明确识别'
  const skillsText = legacyMatch[5].split(',').map((item) => item.trim()).filter(Boolean).join('、') || '技能关键词仍较少'
  const score = legacyMatch[6]

  return `${title} 的简历已完成解析，${contactText}，${experienceText}，当前识别到的重点技能包括 ${skillsText}。当前筛选就绪度为 ${score}/100。`
}

function buildNormalizedResumeSummary(record: Pick<ResumeRecord, 'score'>, contact: ResumeContactInfo, profile: ResumeRecord['profile']) {
  const title = profile.currentTitle?.trim() || '候选人'
  const contactText = [contact.email, contact.phone].filter(Boolean).length >= 2 ? '联系方式较完整' : '联系方式仍需补充'
  const experienceText = profile.yearsExperience ? `约 ${profile.yearsExperience} 年工作经验` : '工作年限暂未明确识别'
  const skillsText = profile.skills.length > 0 ? profile.skills.slice(0, 4).join('、') : '技能关键词仍较少'

  return `${title} 的简历已完成解析，${contactText}，${experienceText}，当前识别到的重点技能包括 ${skillsText}。当前筛选就绪度为 ${record.score}/100。`
}

function localizeLegacyInsightTitle(title: string) {
  switch (title) {
    case 'Contact information is complete':
      return '联系方式较完整'
    case 'Skills section is rich enough for matching':
      return '技能信息较丰富'
    case 'Work history looks credible':
      return '工作经历具备参考价值'
    case 'Critical contact field is missing':
      return '关键联系方式缺失'
    case 'Education details are weak or absent':
      return '教育信息不足'
    case 'Skill keywords could be expanded':
      return '技能关键词可进一步补充'
    case 'Resume content looks too short':
      return '简历内容偏短'
    case 'OCR extraction may be noisy':
      return 'OCR 识别可能存在噪声'
    case 'Experience estimate may need manual review':
      return '工作年限估算建议复核'
    default:
      return title
  }
}

function localizeLegacyInsightDescription(description: string) {
  const skillsMatch = description.match(/^Detected (\d+) market-relevant skills that can feed recommendation and screening\.$/)
  if (skillsMatch) {
    return `已识别 ${skillsMatch[1]} 项与市场相关的技能，有助于推荐和筛选判断。`
  }

  const yearsMatch = description.match(/^The resume shows roughly (\d+) years of experience, enough for role matching\.$/)
  if (yearsMatch) {
    return `简历显示约 ${yearsMatch[1]} 年经验，足以支持岗位匹配判断。`
  }

  switch (description) {
    case 'The resume includes both email and phone, which makes follow-up easier.':
      return '简历中同时包含邮箱和电话，便于后续联系与推进。'
    case 'Email or phone could not be extracted confidently. You may need manual review before outreach.':
      return '邮箱或电话未能稳定识别，建议在联系候选人前人工补全。'
    case 'Adding degree, school, or certification details would make background checks and fit analysis clearer.':
      return '如果补充学校、学历或证书信息，会更有利于背景核验和岗位适配分析。'
    case 'The resume has limited structured skill keywords, which may reduce match quality in automated screening.':
      return '当前结构化技能关键词较少，可能影响自动筛选和匹配质量。'
    case 'The extracted text is brief, so parsing confidence and downstream AI analysis may be limited.':
      return '提取出的文本较少，解析置信度和后续 AI 分析效果可能都会受到影响。'
    case 'Few structured fields were recognized. Manually verify core profile details before screening.':
      return '当前识别出的结构化字段较少，建议在筛选前人工核验核心信息。'
    case 'Detected years are unusually high for a resume. Confirm date parsing before making hiring decisions.':
      return '识别出的工作年限偏高，建议先确认日期解析是否准确，再继续招聘判断。'
    default:
      return description
  }
}

function normalizeInsightExperienceDescription(
  insight: ResumeInsight,
  yearsExperience: number | null
) {
  if (
    insight.title !== '工作经历具备参考价值' &&
    insight.title !== '工作年限估算建议复核'
  ) {
    return insight
  }

  if (yearsExperience === null) {
    if (insight.title === '工作经历具备参考价值') {
      return {
        ...insight,
        title: '工作年限暂不明确',
        description: '当前还无法稳定判断工作年限，建议结合原始简历进一步核验。',
        type: 'warning',
      } satisfies ResumeInsight
    }

    return insight
  }

  return {
    ...insight,
    description:
      insight.title === '工作年限估算建议复核'
        ? `当前识别结果约为 ${yearsExperience} 年，建议结合原始时间线再做确认。`
        : `简历显示约 ${yearsExperience} 年经验，足以支持岗位匹配判断。`,
  } satisfies ResumeInsight
}

function localizeLegacyRecommendedNextAction(action: string) {
  switch (action) {
    case 'Review profile and send first-contact email or interview scheduling link.':
      return '复核候选人资料，并发送首次联系邮件或面试预约链接。'
    case 'Email is missing. Add a valid email before sending written follow-up or assessment links.':
      return '当前缺少邮箱，建议先补充有效邮箱后再发送书面跟进或测评链接。'
    case 'Phone is missing. Start with email outreach and request a callback number if needed.':
      return '当前缺少电话，建议先通过邮件触达，并在需要时补充回拨号码。'
    case 'Manually verify missing contact details before outreach.':
      return '联系候选人前，建议先人工核验缺失的联系方式。'
    case 'Wait for candidate reply, then arrange screening, WeChat, or Feishu interview follow-up.':
      return '等待候选人回复后，再安排筛选沟通、微信或飞书跟进。'
    case 'Wait for the candidate reply, confirm the interview slot, and continue follow-up in email, WeChat, or Feishu.':
      return '等待候选人回复，确认面试时间，并继续通过邮件、微信或飞书跟进。'
    case 'Interview invite preview generated. Deliver it manually, then mark the candidate as contacted.':
      return '面试邀请预览稿已生成，请手动发送，并在完成后更新联系状态。'
    default:
      return action
  }
}

function localizeLegacyWorkflowNotes(notes: string) {
  const lines = notes.split('\n')

  if (lines.length === 0) {
    return notes
  }

  return lines
    .map((line) => {
      if (line.startsWith('[Assessment] ')) {
        return `[测评] ${line.slice('[Assessment] '.length)}`
      }
      if (line.startsWith('Mode: ')) {
        const mode = line.slice('Mode: '.length)
        return `模式：${mode === 'written' ? '笔试' : mode === 'interview' ? '面试' : mode}`
      }
      if (line.startsWith('Score: ')) {
        return `得分：${line.slice('Score: '.length)}`
      }
      if (line.startsWith('Recommendation: ')) {
        const value = line.slice('Recommendation: '.length)
        const localized =
          value === 'strong_yes'
            ? '强烈推荐'
            : value === 'yes'
              ? '推荐'
              : value === 'no'
                ? '不推荐'
                : value === 'pending'
                  ? '待定'
                  : value
        return `建议：${localized}`
      }
      if (line.startsWith('Summary: ')) {
        return `总结：${line.slice('Summary: '.length)}`
      }
      if (line.startsWith('Next step: ')) {
        return `下一步：${line.slice('Next step: '.length)}`
      }

      return line
    })
    .join('\n')
}

function localizeLegacyTaskTitle(title: string) {
  if (title.startsWith('Task created: ')) {
    return `已创建任务：${title.slice('Task created: '.length)}`
  }
  if (title.startsWith('Task completed: ')) {
    return `任务已完成：${title.slice('Task completed: '.length)}`
  }
  if (title.startsWith('Task status updated: ')) {
    return `任务状态已更新：${title.slice('Task status updated: '.length)}`
  }
  if (title.startsWith('Task updated: ')) {
    return `任务已更新：${title.slice('Task updated: '.length)}`
  }
  if (title.startsWith('Task removed: ')) {
    return `任务已移除：${title.slice('Task removed: '.length)}`
  }
  if (title.startsWith('Workflow updated to ')) {
    return `流程已更新为：${stageLabel(title.slice('Workflow updated to '.length))}`
  }
  if (title.startsWith('流程已更新为：')) {
    return `流程已更新为：${stageLabel(title.slice('流程已更新为：'.length))}`
  }
  if (title.startsWith('Candidate moved to ')) {
    return `候选人已推进到：${stageLabel(title.slice('Candidate moved to '.length))}`
  }
  if (title.startsWith('候选人已推进到：')) {
    return `候选人已推进到：${stageLabel(title.slice('候选人已推进到：'.length))}`
  }
  if (title.startsWith('Assessment scored: ')) {
    return `测评已完成评分：${title.slice('Assessment scored: '.length)}`
  }

  switch (title) {
    case 'Verify candidate contact details':
      return '核验候选人联系方式'
    case 'Send receipt and invite candidate to the next step':
      return '发送回执并引导候选人进入下一步'
    case 'Collect a valid email before outreach':
      return '联系前先补充有效邮箱'
    case 'Complete recruiter screening decision':
      return '完成招聘初筛判断'
    case 'Send interview invite and capture interview outcomes':
      return '发送面试邀请并记录面试结果'
    case 'Prepare offer and close the candidate':
      return '准备 Offer 并完成候选人收口'
    case 'Custom follow-up task':
      return '自定义跟进任务'
    case 'Candidate task':
      return '候选人任务'
    case 'Resume uploaded and candidate created':
      return '简历已上传，候选人已创建'
    case 'Candidate contact details updated':
      return '候选人联系方式已更新'
    case 'Recruiter notes updated':
      return '招聘备注已更新'
    case 'Candidate moved to interview stage':
      return '候选人已推进到面试阶段'
    case 'Assessment scored':
      return '测评已完成评分'
    case 'Candidate receipt email sent':
      return '候选人回执邮件已发送'
    case 'Candidate receipt email preview generated':
      return '候选人回执邮件预览稿已生成'
    case 'Candidate receipt delivery failed':
      return '候选人回执邮件发送失败'
    case 'Interview invite email sent':
      return '面试邀请邮件已发送'
    case 'Interview invite preview generated':
      return '面试邀请预览稿已生成'
    case 'Interview invite delivery failed':
      return '面试邀请发送失败'
    case 'Timeline event':
      return '时间线事件'
    case 'Untitled task':
      return '未命名任务'
    default:
      return title
  }
}

function localizeLegacyTaskDescription(description: string | null) {
  if (!description) {
    return null
  }

  if (description.startsWith('Channel: ')) {
    return `渠道：${channelLabel(description.slice('Channel: '.length))}`
  }
  if (description.startsWith('渠道：')) {
    return `渠道：${channelLabel(description.slice('渠道：'.length))}`
  }

  const statusTransition = description.match(/^([a-z_]+) -> ([a-z_]+)$/)
  if (statusTransition) {
    return `${taskStatusLabel(statusTransition[1])} -> ${taskStatusLabel(statusTransition[2])}`
  }

  const intakeStage = description.match(/^Candidate entered intake in stage ([a-z_]+)\.$/)
  if (intakeStage) {
    return `候选人已进入招聘流程，当前阶段：${stageLabel(intakeStage[1])}。`
  }

  const workflowSummary = description.match(/^Review: ([a-z_]+), outreach: ([a-z_]+)\.$/)
  if (workflowSummary) {
    return `评审状态：${reviewStatusLabel(workflowSummary[1])}，联系进度：${outreachStatusLabel(workflowSummary[2])}。`
  }

  const workflowSummaryZh = description.match(/^评审状态：([a-z_]+)，联系进度：([a-z_]+)。$/)
  if (workflowSummaryZh) {
    return `评审状态：${reviewStatusLabel(workflowSummaryZh[1])}，联系进度：${outreachStatusLabel(workflowSummaryZh[2])}。`
  }

  switch (description) {
    case 'Check whether email, phone, and location are complete enough for reliable follow-up.':
      return '检查邮箱、电话和地点是否完整，确保后续跟进顺畅。'
    case 'Use email to confirm receipt and guide the candidate toward WeChat, Feishu, or interview scheduling.':
      return '通过邮件确认已收到简历，并引导候选人进入微信、飞书或面试预约环节。'
    case 'This candidate cannot receive email follow-up yet. Add a valid address first.':
      return '当前候选人暂时无法接收邮件跟进，请先补充有效邮箱。'
    case 'Review resume quality, recruiter notes, and decide whether to reject, interview, or move to assessment.':
      return '结合简历质量和招聘备注，判断是淘汰、进入面试还是推进到测评。'
    case 'Send an interview invite, coordinate scheduling, and capture outcomes in the timeline.':
      return '发送面试邀请、协调时间安排，并在时间线中记录结果。'
    case 'Finalize compensation, offer decision, and close the loop with the candidate.':
      return '确认薪酬与 Offer 决策，并完成候选人沟通收口。'
    case 'Manual recruiter task.':
      return '手动创建的招聘任务。'
    case 'Recruiter corrected or enriched parsed contact fields.':
      return '招聘方修正或补充了系统解析出的联系信息。'
    case 'Task details were changed.':
      return '任务详情已被修改。'
    case 'The recruiter removed this task from the workflow board.':
      return '招聘方已将该任务从看板中移除。'
    case 'Notes were cleared.':
      return '备注已清空。'
    case 'The recruiter initiated the interview outreach step.':
      return '招聘方已启动面试邀请流程。'
    case 'The platform sent the candidate an acknowledgement email.':
      return '系统已向候选人发送简历回执邮件。'
    case 'SMTP is not configured, so a preview was generated for manual outreach.':
      return '当前未配置 SMTP，因此已生成预览稿，需手动发送。'
    case 'The platform emailed the candidate with scheduling and opt-in contact options.':
      return '系统已向候选人发送包含排期与可选联系方式的面试邀请。'
    default:
      return description
  }
}

export function buildRecommendedNextAction(contact: ResumeContactInfo) {
  if (contact.email && contact.phone) {
    return '复核候选人资料，并发送首次联系邮件或面试预约链接。'
  }

  if (!contact.email && contact.phone) {
    return '当前缺少邮箱，建议先补充有效邮箱后再发送书面跟进或测评链接。'
  }

  if (contact.email && !contact.phone) {
    return '当前缺少电话，建议先通过邮件触达，并在需要时补充回拨号码。'
  }

  return '联系候选人前，建议先人工核验缺失的联系方式。'
}

export function buildDefaultWorkflow(record: Pick<ResumeRecord, 'contact' | 'score' | 'createdAt'>): ResumeWorkflow {
  const hasCompleteContact = Boolean(record.contact.email && record.contact.phone)
  const reviewStatus = record.score >= 70 ? 'reviewed' : 'pending'

  return {
    stage: 'new',
    reviewStatus,
    outreachStatus: hasCompleteContact ? 'ready' : 'pending',
    recommendedNextAction: buildRecommendedNextAction(record.contact),
    notes: '',
    lastUpdatedAt: record.createdAt,
  }
}

export function buildDefaultCommunication(): ResumeCommunication {
  return {
    receiptEmailStatus: 'not_sent',
    receiptEmailCount: 0,
    receiptEmailLastAttemptAt: null,
    receiptEmailSentAt: null,
    receiptEmailLastError: null,
    interviewInviteEmailStatus: 'not_sent',
    interviewInviteEmailCount: 0,
    interviewInviteEmailLastAttemptAt: null,
    interviewInviteEmailSentAt: null,
    interviewInviteEmailLastError: null,
  }
}

function buildSystemTaskTitle(kind: CandidateTaskKind, record: ResumeTaskSeed) {
  switch (kind) {
    case 'contact_verification':
      return '核验候选人联系方式'
    case 'first_outreach':
      return record.contact.email
        ? '发送回执并引导候选人进入下一步'
        : '联系前先补充有效邮箱'
    case 'screening_decision':
      return '完成招聘初筛判断'
    case 'interview':
      return '发送面试邀请并记录面试结果'
    case 'offer':
      return '准备 Offer 并完成候选人收口'
    case 'custom':
      return '自定义跟进任务'
    default:
      return '候选人任务'
  }
}

function buildSystemTaskDescription(kind: CandidateTaskKind, record: ResumeTaskSeed) {
  switch (kind) {
    case 'contact_verification':
      return '检查邮箱、电话和地点是否完整，确保后续跟进顺畅。'
    case 'first_outreach':
      return record.contact.email
        ? '通过邮件确认已收到简历，并引导候选人进入微信、飞书或面试预约环节。'
        : '当前候选人暂时无法接收邮件跟进，请先补充有效邮箱。'
    case 'screening_decision':
      return '结合简历质量和招聘备注，判断是淘汰、进入面试还是推进到测评。'
    case 'interview':
      return '发送面试邀请、协调时间安排，并在时间线中记录结果。'
    case 'offer':
      return '确认薪酬与 Offer 决策，并完成候选人沟通收口。'
    case 'custom':
      return '手动创建的招聘任务。'
    default:
      return null
  }
}

function buildSystemTaskChannel(kind: CandidateTaskKind, record: ResumeTaskSeed): CandidateTaskChannel {
  switch (kind) {
    case 'first_outreach':
      return record.contact.email ? 'email' : 'manual'
    case 'interview':
      return record.contact.email ? 'email' : 'feishu'
    case 'offer':
      return 'manual'
    case 'screening_decision':
      return 'manual'
    case 'contact_verification':
      return 'manual'
    case 'custom':
      return 'manual'
    default:
      return 'manual'
  }
}

function buildSystemTaskStatus(kind: CandidateTaskKind, record: ResumeTaskSeed): CandidateTaskStatus {
  switch (kind) {
    case 'contact_verification':
      return record.contact.email && record.contact.phone ? 'done' : 'in_progress'
    case 'first_outreach':
      if (!record.contact.email && !record.contact.phone) {
        return 'blocked'
      }
      if (
        record.communication.receiptEmailStatus === 'sent' ||
        record.communication.interviewInviteEmailStatus === 'sent' ||
        record.workflow.outreachStatus === 'contacted' ||
        record.workflow.outreachStatus === 'responded'
      ) {
        return 'done'
      }
      return record.contact.email || record.contact.phone ? 'todo' : 'blocked'
    case 'screening_decision':
      if (record.workflow.stage === 'interview' || record.workflow.stage === 'offer' || record.workflow.stage === 'hired' || record.workflow.stage === 'rejected') {
        return 'done'
      }
      if (record.workflow.reviewStatus === 'reviewed' || record.workflow.stage === 'screening') {
        return 'in_progress'
      }
      return 'todo'
    case 'interview':
      if (record.workflow.stage === 'offer' || record.workflow.stage === 'hired') {
        return 'done'
      }
      return record.workflow.stage === 'interview' ? 'in_progress' : 'todo'
    case 'offer':
      if (record.workflow.stage === 'hired') {
        return 'done'
      }
      return record.workflow.stage === 'offer' ? 'in_progress' : 'todo'
    case 'custom':
      return 'todo'
    default:
      return 'todo'
  }
}

function normalizeTimelineEvent(
  event: Partial<CandidateTimelineEvent>,
  fallbackCreatedAt: string
): CandidateTimelineEvent {
  return {
    id: typeof event.id === 'string' && event.id.trim() ? event.id : crypto.randomUUID(),
    type: event.type ?? 'workflow_updated',
    actor: event.actor ?? 'system',
    title:
      typeof event.title === 'string' && event.title.trim()
        ? localizeLegacyTaskTitle(event.title.trim())
        : '时间线事件',
    description:
      typeof event.description === 'string' && event.description.trim()
        ? localizeLegacyTaskDescription(event.description.trim())
        : null,
    createdAt:
      typeof event.createdAt === 'string' && event.createdAt.trim() ? event.createdAt : fallbackCreatedAt,
  }
}

function normalizeTask(task: Partial<CandidateTask>, fallbackCreatedAt: string): CandidateTask {
  const status = task.status ?? 'todo'

  return {
    id: typeof task.id === 'string' && task.id.trim() ? task.id : crypto.randomUUID(),
    kind: task.kind ?? 'custom',
    title:
      typeof task.title === 'string' && task.title.trim()
        ? localizeLegacyTaskTitle(task.title.trim())
        : '未命名任务',
    description:
      typeof task.description === 'string' && task.description.trim()
        ? localizeLegacyTaskDescription(task.description.trim())
        : null,
    status,
    channel: task.channel ?? 'manual',
    owner: typeof task.owner === 'string' && task.owner.trim() ? task.owner.trim() : null,
    dueAt: typeof task.dueAt === 'string' && task.dueAt.trim() ? task.dueAt : null,
    createdAt:
      typeof task.createdAt === 'string' && task.createdAt.trim() ? task.createdAt : fallbackCreatedAt,
    updatedAt:
      typeof task.updatedAt === 'string' && task.updatedAt.trim() ? task.updatedAt : fallbackCreatedAt,
    completedAt:
      status === 'done'
        ? typeof task.completedAt === 'string' && task.completedAt.trim()
          ? task.completedAt
          : task.updatedAt ?? fallbackCreatedAt
        : null,
  }
}

export function createCandidateTask(
  kind: CandidateTaskKind,
  record: ResumeTaskSeed,
  overrides: Partial<CandidateTask> = {}
): CandidateTask {
  const createdAt = overrides.createdAt ?? record.createdAt
  const status = overrides.status ?? buildSystemTaskStatus(kind, record)

  return normalizeTask(
    {
      id: overrides.id,
      kind,
      title: overrides.title ?? buildSystemTaskTitle(kind, record),
      description: overrides.description ?? buildSystemTaskDescription(kind, record),
      status,
      channel: overrides.channel ?? buildSystemTaskChannel(kind, record),
      owner: overrides.owner,
      dueAt: overrides.dueAt,
      createdAt,
      updatedAt: overrides.updatedAt ?? createdAt,
      completedAt: overrides.completedAt ?? (status === 'done' ? createdAt : null),
    },
    createdAt
  )
}

export function createTimelineEvent(input: {
  type: CandidateTimelineEventType
  actor?: CandidateTimelineActor
  title: string
  description?: string | null
  createdAt?: string
}): CandidateTimelineEvent {
  const createdAt = input.createdAt ?? new Date().toISOString()

  return normalizeTimelineEvent(
    {
      type: input.type,
      actor: input.actor ?? 'system',
      title: input.title,
      description: input.description ?? null,
      createdAt,
    },
    createdAt
  )
}

export function buildDefaultTimeline(record: Pick<ResumeRecord, 'createdAt' | 'contact' | 'workflow'>) {
  return [
    createTimelineEvent({
      type: 'resume_uploaded',
      title: '简历已上传，候选人已创建',
      description: `候选人已进入招聘流程，当前阶段：${stageLabel(record.workflow.stage)}。`,
      createdAt: record.createdAt,
    }),
  ]
}

export function syncCandidateTasks(record: ResumeTaskSeed, existingTasks: CandidateTask[] = []) {
  const now = new Date().toISOString()
  const byKind = new Map<CandidateTaskKind, CandidateTask>()
  const customTasks: CandidateTask[] = []

  for (const task of existingTasks) {
    const normalized = normalizeTask(task, record.createdAt)

    if (normalized.kind === 'custom') {
      customTasks.push(normalized)
      continue
    }

    if (!byKind.has(normalized.kind)) {
      byKind.set(normalized.kind, normalized)
    }
  }

  const requiredKinds: CandidateTaskKind[] = ['contact_verification', 'first_outreach', 'screening_decision']

  if (record.workflow.stage === 'interview' || record.workflow.stage === 'offer' || record.workflow.stage === 'hired') {
    requiredKinds.push('interview')
  }

  if (record.workflow.stage === 'offer' || record.workflow.stage === 'hired') {
    requiredKinds.push('offer')
  }

  const systemTasks = requiredKinds.map((kind) => {
    const existing = byKind.get(kind)
    const nextStatus = buildSystemTaskStatus(kind, record)
    const task = createCandidateTask(kind, record, {
      ...existing,
      status: nextStatus,
      title: existing?.title ?? buildSystemTaskTitle(kind, record),
      description: existing?.description ?? buildSystemTaskDescription(kind, record),
      channel: existing?.channel ?? buildSystemTaskChannel(kind, record),
      owner: existing?.owner ?? null,
      dueAt: existing?.dueAt ?? null,
      createdAt: existing?.createdAt ?? record.createdAt,
      updatedAt:
        existing && existing.status === nextStatus
          ? existing.updatedAt
          : now,
      completedAt:
        nextStatus === 'done'
          ? existing?.completedAt ?? now
          : null,
    })

    return task
  })

  return [...systemTasks, ...customTasks].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  })
}

export function buildDefaultTasks(record: ResumeTaskSeed) {
  return syncCandidateTasks(record, [])
}

export function normalizeResumeRecord(record: ResumeRecord): ResumeRecord {
  const normalizedContact = normalizeResumeContactInfo(record.contact)
  const workflowDefaults = buildDefaultWorkflow(record)
  const communicationDefaults = buildDefaultCommunication()
  const derivedYearsExperience = record.extractedText
    ? estimateYearsExperienceFromResumeText(record.extractedText)
    : null
  const normalizedYearsExperience =
    derivedYearsExperience !== null &&
    (record.profile.yearsExperience === null || Math.abs(derivedYearsExperience - record.profile.yearsExperience) >= 6)
      ? derivedYearsExperience
      : record.profile.yearsExperience
  const normalizedProfile = {
    ...record.profile,
    currentTitle: record.profile.currentTitle?.trim() || null,
    yearsExperience: normalizedYearsExperience,
  }

  const normalizedRecord: ResumeRecord = {
    ...record,
    ownerUserId: record.ownerUserId ?? null,
    ownerName: record.ownerName ?? null,
    ownerEmail: record.ownerEmail ?? normalizedContact.email ?? null,
    cloudFileId: typeof record.cloudFileId === 'string' ? record.cloudFileId : null,
    storageProvider: record.storageProvider === 'cloudbase' ? 'cloudbase' : 'local',
    summary:
      normalizedYearsExperience !== record.profile.yearsExperience
        ? buildNormalizedResumeSummary(record, normalizedContact, normalizedProfile)
        : localizeLegacySummary(record.summary),
    profile: normalizedProfile,
    insights: record.insights.map((insight) =>
      normalizeInsightExperienceDescription(
        {
          ...insight,
          title: localizeLegacyInsightTitle(insight.title),
          description: localizeLegacyInsightDescription(insight.description),
        },
        normalizedYearsExperience
      )
    ),
    composition: record.composition.map((item) => ({
      ...item,
      name: localizeCompositionName(item.name),
    })),
    contact: normalizedContact,
    workflow: {
      ...workflowDefaults,
      ...record.workflow,
      recommendedNextAction:
        record.workflow?.recommendedNextAction
          ? localizeLegacyRecommendedNextAction(record.workflow.recommendedNextAction)
          : buildRecommendedNextAction(normalizedContact),
      notes: record.workflow?.notes ? localizeLegacyWorkflowNotes(record.workflow.notes) : '',
      lastUpdatedAt: record.workflow?.lastUpdatedAt ?? record.createdAt,
    },
    communication: {
      ...communicationDefaults,
      ...record.communication,
    },
    tasks: [],
    timeline: [],
  }

  normalizedRecord.tasks = syncCandidateTasks(normalizedRecord, Array.isArray(record.tasks) ? record.tasks : [])
  normalizedRecord.timeline = (
    Array.isArray(record.timeline) && record.timeline.length > 0
      ? record.timeline
      : buildDefaultTimeline(normalizedRecord)
  ).map((event) => normalizeTimelineEvent(event, normalizedRecord.createdAt))

  return normalizedRecord
}
