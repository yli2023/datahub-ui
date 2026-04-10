<template>
  <div class="layout-padding">
    <div class="layout-padding-auto layout-padding-view">
      <el-alert
        class="mb-4"
        type="info"
        show-icon
        :closable="false"
        title="在「选择」进入图表页后，可绘制双 Y 曲线并使用「AI 智能分析」（统计特征 + 知识库 RAG + 可选大模型）。"
      />
      <el-row>
        <div class="mb8" style="width: 100%">
          <el-button icon="folder-add" type="primary" class="ml10" @click="formDialogRef.openDialog()"
            v-auth="'demo_control_add'">
            新 增
          </el-button>
          <el-button plain :disabled="multiple" icon="Delete" type="primary"
            v-auth="'demo_control_del'" @click="handleDelete(selectObjs)">
            删除
          </el-button>
          <right-toolbar v-model:showSearch="showSearch" :export="'demo_control_export'"
                @exportExcel="exportExcel" class="ml10 mr20" style="float: right;"
            @queryTable="getDataList"></right-toolbar>
        </div>
      </el-row>
      <el-table :data="state.dataList" v-loading="state.loading" border 
        :cell-style="tableStyle.cellStyle" :header-cell-style="tableStyle.headerCellStyle"
				@selection-change="selectionChangHandle"
        @sort-change="sortChangeHandle">
        <el-table-column type="selection" width="40" align="center" />
        <el-table-column type="index" label="#" width="40" />
          <el-table-column prop="username" label="表名"  show-overflow-tooltip/>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button icon="edit-pen" text type="primary" v-auth="'demo_control_edit'"
              @click="formDialogRef.openDialog(scope.row.id)">编辑</el-button>
            <el-button icon="delete" text type="primary" v-auth="'demo_control_del'" @click="handleDelete([scope.row.id])">删除</el-button>
            <el-button id="add" @click="openTable(scope.row.username)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination @size-change="sizeChangeHandle" @current-change="currentChangeHandle" v-bind="state.pagination" />
    </div>

    <form-dialog ref="formDialogRef" @refresh="getDataList(false)" />

  </div>
</template>

<script setup lang="ts" name="systemControl">
import { BasicTableProps, useTable } from "/@/hooks/table";
import { fetchList, delObjs } from "/@/api/demo/control";
import { useMessage, useMessageBox } from "/@/hooks/message";
import { useDict } from '/@/hooks/dict';
import router from "/@/router";

// 引入组件
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

const {
  getDataList,
  currentChangeHandle,
  sizeChangeHandle,
  sortChangeHandle,
  downBlobFile,
	tableStyle
} = useTable(state)

const resetQuery = () => {
  queryRef.value?.resetFields()
  selectObjs.value = []
  getDataList()
}

const exportExcel = () => {
  downBlobFile('/demo/control/export', Object.assign(state.queryForm, { ids: selectObjs }), 'control.xlsx')
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

const openTable = (tableName: string) => {
  // 仅用路由跳转并携带 query；不要用 location.href 整页刷新，否则会丢掉 tableName，导致列名下拉首次为空
  router.push({
    path: '/demo/demo/index',
    query: { tableName: String(tableName) },
  });
};

function handleButtonClick(tableName: any) {
  var paramValue = tableName;
  var url = "http://localhost:8888/demo/index.html#/demo/" + paramValue + "/index";
  window.location.href = url;
}

</script>
