<template>
  <div class="layout-padding">
    <div class="layout-padding-auto layout-padding-view">
      <el-button @click="dialogVisible = true">点击绘制图表</el-button>
        <div class="sm:flex"></div>
          <el-dialog title="图表" 
            :modal-append-to-body='true'
            v-model="dialogVisible"
              @open="onChartDialogOpen"
              append-to-body>
              <el-card class="sm:mr-4 flex-1 !border-none mt-4" shadow="never">
                <div>
                  <div class="flex h-[400px] items-center" ref="commandChartRef" style="flex-grow: 2;"></div>
                </div>
              </el-card>
              <div class="mt-4">
                <el-space wrap>
                  <el-button type="primary" :loading="aiLoading" @click="runAiAnalysis">AI 智能分析</el-button>
                  <el-button @click="clearAiSession" :disabled="aiLoading">清空对话</el-button>
                  <el-button @click="exportAiSession" :disabled="!analysisRecords.length">导出对话</el-button>
                  <el-button @click="exportAiSessionMarkdown" :disabled="!analysisRecords.length">导出 Markdown</el-button>
                </el-space>
                <div class="mt-2 ai-history-config">
                  <span class="text-xs text-gray-500">显示最近</span>
                  <el-input-number v-model="maxDisplayRecords" :min="1" :max="50" :step="1" size="small" />
                  <span class="text-xs text-gray-500">轮</span>
                  <span v-if="hiddenRecordCount > 0" class="text-xs text-gray-400">（已折叠 {{ hiddenRecordCount }} 轮更早记录）</span>
                </div>
                <el-input
                  v-model="followUpInput"
                  class="mt-2"
                  type="textarea"
                  :rows="2"
                  placeholder="可选：追问（将带上文对话历史）。首次可直接点「AI 智能分析」。"
                  @keydown.enter.exact.prevent="handleFollowUpEnter"
                />
                <div class="mt-2 ai-follow-up-actions">
                  <el-button
                    type="primary"
                    plain
                    size="small"
                    :loading="aiLoading"
                    :disabled="!followUpInput.trim()"
                    @click="submitFollowUp"
                  >
                    发送追问
                  </el-button>
                  <span class="text-xs text-gray-400">Enter 发送，Shift+Enter 换行</span>
                </div>
                <el-collapse v-if="displayedAnalysisRecords.length" class="mt-3">
                  <el-collapse-item
                    v-for="(record, idx) in displayedAnalysisRecords"
                    :key="record.id"
                    :title="`分析结果 #${analysisRecords.length - idx}（${record.questionLabel}）`"
                    :name="record.id"
                  >
                    <div class="text-xs text-gray-500 mb-2">问题：{{ record.question || '首轮分析' }}</div>
                    <div class="text-sm text-gray-700 mb-2">回答：{{ record.result.summary }}</div>
                    <div v-if="hasDiagnosis(record.result)" class="mb-2">
                      <b>诊断细节</b>
                    </div>
                    <div v-if="record.result.anomalyNotes?.length" class="mb-2">
                      <b>异常提示</b>
                      <ul class="list-disc pl-5 text-sm"><li v-for="(x,i) in record.result.anomalyNotes" :key="'a'+record.id+i">{{ x }}</li></ul>
                    </div>
                    <div v-if="record.result.possibleCauses?.length" class="mb-2">
                      <b>可能原因</b>
                      <ul class="list-disc pl-5 text-sm"><li v-for="(x,i) in record.result.possibleCauses" :key="'c'+record.id+i">{{ x }}</li></ul>
                    </div>
                    <div v-if="record.result.actions?.length" class="mb-2">
                      <b>建议动作</b>
                      <ul class="list-disc pl-5 text-sm"><li v-for="(x,i) in record.result.actions" :key="'t'+record.id+i">{{ x }}</li></ul>
                    </div>
                    <div v-if="record.result.citations?.length">
                      <b>知识库引用 (RAG)</b>
                      <el-card v-for="c in citationsPreview(record.result.citations)" :key="record.id + c.id" class="mb-2" shadow="never">
                        <div class="text-sm font-medium">{{ c.title }} <span class="text-gray-400">score={{ c.score?.toFixed?.(3) ?? c.score }}</span></div>
                        <pre class="text-xs whitespace-pre-wrap mt-1">{{ c.excerpt }}</pre>
                      </el-card>
                      <div v-if="record.result.citations.length > 2" class="text-xs text-gray-400">其余 {{ record.result.citations.length - 2 }} 条引用已折叠在导出文件中。</div>
                    </div>
                    <details class="ai-meta mt-2">
                      <summary>查看技术元数据</summary>
                      <el-descriptions :column="1" border size="small" class="mb-2 mt-2">
                        <el-descriptions-item label="置信度">{{ record.result.confidence?.toFixed?.(2) ?? record.result.confidence }}</el-descriptions-item>
                        <el-descriptions-item label="模型">{{ record.result.meta?.model }} / LLM: {{ record.result.meta?.usedLlm ? '是' : '否' }}</el-descriptions-item>
                        <el-descriptions-item label="耗时 ms">{{ record.result.meta?.latencyMs }}</el-descriptions-item>
                        <el-descriptions-item label="Prompt">{{ record.result.meta?.promptVersion }} / trace {{ record.result.meta?.traceId }}</el-descriptions-item>
                      </el-descriptions>
                    </details>
                  </el-collapse-item>
                </el-collapse>
              </div>
          </el-dialog>
      <el-row>
        <div class="mb8" style="width: 100%">
          <el-form-item label="参数选择">
            <el-select placeholder="选择一个y轴参数" v-model="y1Name">
              <el-option :key="item" :label="item" :value="item" v-for="item in column.list"></el-option>
            </el-select>
            <el-select placeholder="选择一个y轴参数" v-model="y2Name">
              <el-option :key="item" :label="item" :value="item" v-for="item in column.list"></el-option>
            </el-select>
            <div class="demo-datetime-picker">
              <div class="block">
                <span class="demonstration">StartTime</span>
                <el-date-picker
                  v-model="start"
                  type="datetime"
                  placeholder="Select date and time"
                />
              </div>
              <div class="block">
                <span class="demonstration">EndTime</span>
                <el-date-picker
                  v-model="end"
                  type="datetime"
                  placeholder="Select date and time"
                />
              </div>
            </div>
            <el-input-number v-model="num" :min="-10" :max="10" @change="handleChange" />
          </el-form-item>
        </div>
      </el-row>
		</div>

    <form-dialog ref="formDialogRef" @refresh="getDataList(false)" />
  </div>
</template>

<script setup lang="ts" name="systemDemo">
import dayjs from 'dayjs';
import { BasicTableProps, useTable } from "/@/hooks/table";
import { fetchList, delObjs , getObjlist , getObjlist_page, getColumn, getProcess } from "/@/api/demo/demo";
import { aiAnalyze, type AiAnalysisResponse } from '/@/api/demo/ai';
import { useMessage, useMessageBox } from "/@/hooks/message";
import * as echarts from 'echarts';
import { markRaw, unref, computed, watch, onActivated, nextTick } from 'vue';
import { useRoute } from 'vue-router'


const FormDialog = defineAsyncComponent(() => import('./form.vue'));

const formDialogRef = ref()
const queryRef = ref()
const showSearch = ref(true)
const selectObjs = ref([]) as any
const multiple = ref(true)

const state: BasicTableProps = reactive<BasicTableProps>({
  queryForm: {},
  pageList: fetchList
})

const column = reactive({
  list: <any>[]
})


const route = useRoute()

const tableNameParam = computed(() => {
  const q = route.query.tableName
  const v = Array.isArray(q) ? q[0] : q
  return v != null && v !== '' ? String(v) : ''
})

const getList = async () => {
  const tn = tableNameParam.value
  if (!tn) {
    column.list = []
    return
  }
  try {
    column.list = await getColumn({ tableName: tn })
  } catch (e: any) {
    useMessage().error(e?.message || '加载列名失败')
    column.list = []
  }
}

watch(
  tableNameParam,
  () => {
    nextTick(() => getList());
  },
  { immediate: true }
)

onActivated(() => {
  nextTick(() => getList());
})

const {
  getDataList,
  currentChangeHandle,
  sizeChangeHandle,
  sortChangeHandle,
  downBlobFile,
	tableStyle
} = useTable(state)

const handleSelectList = async () => {
  state.queryForm = {};
  state.pageList = getObjlist_page
  getDataList()
};

const resetQuery = () => {
  queryRef.value?.resetFields()
  selectObjs.value = []
  getDataList()
}

const exportExcel = () => {
  downBlobFile('/demo/demo/export', Object.assign(state.queryForm, { ids: selectObjs }), 'demo.xlsx')
}

const selectionChangHandle = (objs: { id: string }[]) => {
  selectObjs.value = objs.map(({ id }) => id);
  multiple.value = !objs.length;
};

const handleDelete = async (ids: string[]) => {
  try {
    await useMessageBox().confirm('此操作将永久删除');
  } catch {
    return;
  }

  try {
    await delObjs(ids);
    getDataList();
    useMessage().success('删除成功');
  } catch (err: any) {
    useMessage().error(err.msg);
  }
};

const xName = ref();
const y1Name = ref();
const y2Name = ref();
const start = ref('');
const end = ref('');

const num = ref(1)
const handleChange = (value: number) => {
  console.log(value)
}

const dialogVisible = ref(false);

const aiLoading = ref(false);
const aiResult = ref<AiAnalysisResponse | null>(null);
const followUpInput = ref('');
const conversationHistory = ref<{ role: string; content: string }[]>([]);
const analysisRecords = ref<{ id: string; createdAt: string; question: string; questionLabel: string; result: AiAnalysisResponse }[]>([]);
const maxDisplayRecords = ref(5);
const displayedAnalysisRecords = computed(() => analysisRecords.value.slice(0, maxDisplayRecords.value));
const hiddenRecordCount = computed(() => Math.max(0, analysisRecords.value.length - displayedAnalysisRecords.value.length));
const exportRecordsAsc = computed(() => [...analysisRecords.value].reverse());

const hasDiagnosis = (r: AiAnalysisResponse) =>
  Boolean((r.anomalyNotes && r.anomalyNotes.length) || (r.possibleCauses && r.possibleCauses.length) || (r.actions && r.actions.length));

const citationsPreview = (citations: AiAnalysisResponse['citations']) => (citations || []).slice(0, 2);

const onChartDialogOpen = () => {
  makeChart1(tableNameParam.value, y1Name, y2Name, num);
};

const clearAiSession = () => {
  conversationHistory.value = [];
  aiResult.value = null;
  followUpInput.value = '';
  analysisRecords.value = [];
};

const exportAiSession = () => {
  if (!analysisRecords.value.length) {
    useMessage().warning('当前没有可导出的对话记录');
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    tableName: tableNameParam.value,
    y1Name: String(y1Name.value ?? ''),
    y2Name: String(y2Name.value ?? ''),
    startTime: String(start.value ?? ''),
    endTime: String(end.value ?? ''),
    records: exportRecordsAsc.value.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      question: r.question,
      result: r.result,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-session-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  useMessage().success('对话记录已导出');
};

const exportAiSessionMarkdown = () => {
  if (!analysisRecords.value.length) {
    useMessage().warning('当前没有可导出的对话记录');
    return;
  }
  const header = [
    '# AI 分析对话导出',
    '',
    `- 导出时间: ${new Date().toLocaleString()}`,
    `- 表名: ${tableNameParam.value || '-'}`,
    `- Y1: ${String(y1Name.value ?? '-')}`,
    `- Y2: ${String(y2Name.value ?? '-')}`,
    `- 开始时间: ${String(start.value ?? '-')}`,
    `- 结束时间: ${String(end.value ?? '-')}`,
    '',
  ].join('\n');

  let prevCitationSig = '';
  const body = exportRecordsAsc.value.map((r, idx) => {
    const result = r.result;
    const notes = (result.anomalyNotes || []).map((x) => `- ${x}`).join('\n');
    const causes = (result.possibleCauses || []).map((x) => `- ${x}`).join('\n');
    const actions = (result.actions || []).map((x) => `- ${x}`).join('\n');
    const citationSig = JSON.stringify((result.citations || []).map((c) => `${c.title}:${(c.score ?? 0).toFixed?.(3) ?? c.score}`));
    const citations = (result.citations || [])
      .map((c) => `- ${c.title} (score=${(c.score ?? 0).toFixed?.(3) ?? c.score})\n  - ${c.excerpt}`)
      .join('\n');
    const citationSection = !citations
      ? []
      : citationSig === prevCitationSig
        ? ['### 知识库引用 (RAG)', '与上一轮相同，已省略。', '']
        : ['### 知识库引用 (RAG)', citations, ''];
    prevCitationSig = citationSig;
    return [
      `## 第 ${idx + 1} 轮`,
      '',
      `- 时间: ${new Date(r.createdAt).toLocaleString()}`,
      `- 问题: ${r.question || '首轮分析'}`,
      '',
      '### AI回答',
      result.summary || '-',
      '',
      ...(notes ? ['### 异常提示', notes, ''] : []),
      ...(causes ? ['### 可能原因', causes, ''] : []),
      ...(actions ? ['### 建议动作', actions, ''] : []),
      ...citationSection,
      '### 技术元数据',
      `- 置信度: ${result.confidence?.toFixed?.(2) ?? result.confidence}`,
      `- 模型: ${result.meta?.model} / LLM: ${result.meta?.usedLlm ? '是' : '否'}`,
      `- 耗时(ms): ${result.meta?.latencyMs}`,
      `- Trace: ${result.meta?.traceId}`,
      '',
    ].join('\n');
  }).join('\n');

  const markdown = `${header}${body}`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-session-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  useMessage().success('Markdown 已导出');
};

const submitFollowUp = async () => {
  if (!followUpInput.value.trim()) {
    return;
  }
  if (!aiResult.value && conversationHistory.value.length === 0) {
    useMessage().warning('请先点击一次「AI 智能分析」生成首轮结果，再进行追问。');
    return;
  }
  await runAiAnalysis();
};

const handleFollowUpEnter = async (event: KeyboardEvent) => {
  if (event.isComposing) {
    return;
  }
  await submitFollowUp();
};

const runAiAnalysis = async () => {
  const tn = tableNameParam.value
  if (!tn || !y1Name.value || !y2Name.value || !start.value || !end.value) {
    useMessage().warning('请先选择表、两列 Y 与起止时间');
    return;
  }
  const starting = dayjs(new Date(start.value as any)).format('YYYY-MM-DD HH:mm:ss');
  const ending = dayjs(new Date(end.value as any)).format('YYYY-MM-DD HH:mm:ss');
  aiLoading.value = true;
  try {
    const fu = (followUpInput.value || '').trim();
    const res = await aiAnalyze({
      tableName: tn,
      y1Name: String(y1Name.value),
      y2Name: String(y2Name.value),
      startTime: starting,
      endTime: ending,
      num: num.value ?? 0,
      followUpQuestion: fu || undefined,
      conversationHistory: [...conversationHistory.value],
    });
    aiResult.value = res;
    const q = (fu || '').trim();
    analysisRecords.value.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      question: q,
      questionLabel: q ? (q.length > 24 ? `${q.slice(0, 24)}...` : q) : '首轮分析',
      result: res,
    });
    const assistantText = res.plainText || res.summary || '';
    if (fu) {
      conversationHistory.value.push({ role: 'user', content: fu });
    }
    conversationHistory.value.push({ role: 'assistant', content: assistantText });
    followUpInput.value = '';
    useMessage().success('分析完成');
  } catch (err: any) {
    useMessage().error(err?.msg || err?.message || '分析失败');
  } finally {
    aiLoading.value = false;
  }
};

const commandChartRef = ref();

const chartOptions = reactive({
  commandChartOption: {
    legend: {
        data: ['first', 'second', ]
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: '{HH}:{mm}:{ss}',
        rotate: 40
      }
    },
    yAxis: {},
		series: [
      {
        name: 'first',
        type: 'line',
        data: <any>[[]],
        lineStyle: {
            color: 'green',
            width: 4,
            type: 'solid'
        }
      },
      {
        name: 'second',
        type: 'line',
        data: <any>[[]],
        lineStyle: {
            color: 'blue',
            width: 4,
            type: 'solid'
        }
			},
    ],
    tooltip: {
     trigger: 'item',
     backgroundColor: 'rgba(32, 33, 36,.7)',
     borderColor: 'rgba(32, 33, 36,0.20)',
     borderWidth: 1,
     textStyle: {
       color: '#fff',
       fontSize: '12'
     },
     axisPointer: {
       type: 'cross',
       label: {
           backgroundColor: '#6a7985'
       }
     },
    }  
	},
});

const makeChart1 = async (property1: any, property2: any, property3: any, property4:any) => {

  const dateObj1 = new Date(start.value);
  const starting = dayjs(dateObj1).format('YYYY-MM-DD HH:mm:ss');
  const dateObj2 = new Date(end.value);
  const ending = dayjs(dateObj2).format('YYYY-MM-DD HH:mm:ss');

  const tn = String(unref(property1) ?? '')
  const col1 = String(unref(property2) ?? '')
  const col2 = String(unref(property3) ?? '')
  const n = Number(unref(property4) ?? 0)
  if (!tn || !col1 || !col2) {
    useMessage().warning('请选择数据表与两个 Y 轴列名');
    return;
  }

  try {
    const detaaxis1 = await getProcess({ tableName: tn, startTime: starting, endTime: ending, columnName: col1, num: 0 })
    const detaaxis2 = await getProcess({ tableName: tn, startTime: starting, endTime: ending, columnName: col2, num: n })
    const timeaxis = await getObjlist({ tableName: tn, startTime: starting, endTime: ending })

    const pairs1 = timeaxis.map((item, index) => [item, detaaxis1[index]]);
    const pairs2 = timeaxis.map((item, index) => [item, detaaxis2[index]]);

    chartOptions.commandChartOption.series[0].data = pairs1;
    chartOptions.commandChartOption.series[1].data = pairs2;

    const commandChart = markRaw(echarts.init(commandChartRef.value));
    commandChart.setOption(chartOptions.commandChartOption);
  } catch (e: any) {
    useMessage().error(e?.message || '绘图数据请求失败');
  }
};
</script>

<style scoped>
.demo-datetime-picker {
  display: flex;
  width: 100%;
  padding: 0;
  flex-wrap: wrap;
}
.demo-datetime-picker .block {
  padding: 30px 0;
  text-align: center;
  border-right: solid 1px var(--el-border-color);
  flex: 1;
}
.demo-datetime-picker .block:last-child {
  border-right: none;
}
.demo-datetime-picker .demonstration {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 20px;
}

.ai-follow-up-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-history-config {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-meta summary {
  cursor: pointer;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
