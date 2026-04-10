import request from '/@/utils/request'

export interface AiAnalysisRequest {
	tableName: string
	y1Name: string
	y2Name: string
	startTime: string
	endTime: string
	num: number
	followUpQuestion?: string
	conversationHistory?: { role: string; content: string }[]
}

/** 后端 R 包装后的 data 字段 */
export interface AiAnalysisResponse {
	summary: string
	anomalyNotes: string[]
	possibleCauses: string[]
	actions: string[]
	confidence: number
	citations: { id: string; title: string; excerpt: string; score: number }[]
	plainText: string
	meta: {
		latencyMs: number
		promptVersion: string
		model: string
		usedLlm: boolean
		traceId: string
	}
}

export async function aiAnalyze(data: AiAnalysisRequest): Promise<AiAnalysisResponse> {
	const res: any = await request({
		url: '/demo/demo/ai/analyze',
		method: 'post',
		data,
	})
	return res.data
}

export async function aiMetrics(): Promise<Record<string, number>> {
	const res: any = await request({
		url: '/demo/demo/ai/metrics',
		method: 'get',
	})
	return res.data
}
