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
                </el-space>
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
                <el-collapse v-if="analysisRecords.length" class="mt-3">
                  <el-collapse-item
                    v-for="(record, idx) in analysisRecords"
                    :key="record.id"
                    :title="`分析结果 #${analysisRecords.length - idx}（${record.questionLabel}）`"
                    :name="record.id"
                  >
                    <p class="text-sm text-gray-600 mb-2">{{ record.result.summary }}</p>
                    <el-descriptions :column="1" border size="small" class="mb-2">
                      <el-descriptions-item label="置信度">{{ record.result.confidence?.toFixed?.(2) ?? record.result.confidence }}</el-descriptions-item>
                      <el-descriptions-item label="模型">{{ record.result.meta?.model }} / LLM: {{ record.result.meta?.usedLlm ? '是' : '否' }}</el-descriptions-item>
                      <el-descriptions-item label="耗时 ms">{{ record.result.meta?.latencyMs }}</el-descriptions-item>
                      <el-descriptions-item label="Prompt">{{ record.result.meta?.promptVersion }} / trace {{ record.result.meta?.traceId }}</el-descriptions-item>
                    </el-descriptions>
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
                      <el-card v-for="c in record.result.citations" :key="record.id + c.id" class="mb-2" shadow="never">
                        <div class="text-sm font-medium">{{ c.title }} <span class="text-gray-400">score={{ c.score?.toFixed?.(3) ?? c.score }}</span></div>
                        <pre class="text-xs whitespace-pre-wrap mt-1">{{ c.excerpt }}</pre>
                      </el-card>
                    </div>
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
const analysisRecords = ref<{ id: string; questionLabel: string; result: AiAnalysisResponse }[]>([]);

const onChartDialogOpen = () => {
  makeChart1(tableNameParam.value, y1Name, y2Name, num);
};

const clearAiSession = () => {
  conversationHistory.value = [];
  aiResult.value = null;
  followUpInput.value = '';
  analysisRecords.value = [];
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
</style>
