var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// packages/diagnosis/src/analyzer.ts
function analyzeNetwork(records) {
  const refs = [];
  const suggestions = [];
  const failed = records.filter((r) => r.status >= 400 || r.error);
  const slow = records.filter((r) => r.durationMs > 3e3);
  for (const r of failed) {
    refs.push({
      kind: "network",
      severity: r.status >= 500 ? "error" : "warning",
      message: `\u8BF7\u6C42\u5931\u8D25 ${r.method} ${r.url} (${r.status}${r.statusText ? " " + r.statusText : ""})${r.error ? " \u2014 " + r.error : ""}`,
      detail: { durationMs: r.durationMs, requestId: r.requestId },
      timestamp: Date.now()
    });
  }
  for (const r of slow) {
    refs.push({
      kind: "network",
      severity: "warning",
      message: `\u6162\u8BF7\u6C42 ${r.durationMs}ms ${r.method} ${r.url}`,
      detail: { status: r.status },
      timestamp: Date.now()
    });
  }
  if (failed.length) suggestions.push(`\u7F51\u7EDC\u5B58\u5728 ${failed.length} \u4E2A\u5931\u8D25\u8BF7\u6C42\uFF0C\u53EF\u80FD\u662F\u8D44\u6E90 404/500 \u6216 CORS/\u8DE8\u57DF\u963B\u65AD`);
  if (slow.length) suggestions.push(`\u5B58\u5728 ${slow.length} \u4E2A\u6162\u8BF7\u6C42(>3s)\uFF0C\u8003\u8651\u68C0\u67E5\u540E\u7AEF\u63A5\u53E3\u6216\u8D44\u6E90\u52A0\u8F7D`);
  return { refs, suggestions };
}
function analyzePerformance(metrics) {
  const refs = [];
  const suggestions = [];
  if (metrics.ttfb > 1e3) {
    refs.push({
      kind: "performance",
      severity: "warning",
      message: `TTFB \u504F\u9AD8: ${metrics.ttfb}ms\uFF08\u9996\u5B57\u8282\u54CD\u5E94\u6162\uFF0C\u53EF\u80FD\u670D\u52A1\u7AEF\u6162\u6216\u7F51\u7EDC\u5DEE\uFF09`,
      timestamp: Date.now()
    });
    suggestions.push("TTFB > 1s\uFF0C\u4F18\u5148\u6392\u67E5\u670D\u52A1\u7AEF\u54CD\u5E94\u4E0E CDN");
  }
  if (metrics.lcp && metrics.lcp > 2500) {
    refs.push({
      kind: "performance",
      severity: "warning",
      message: `LCP \u504F\u9AD8: ${metrics.lcp}ms\uFF08\u6700\u5927\u5185\u5BB9\u7ED8\u5236\u6162\uFF0C\u5F71\u54CD\u9996\u5C4F\uFF09`,
      timestamp: Date.now()
    });
    suggestions.push("LCP > 2.5s\uFF0C\u5173\u6CE8\u9996\u5C4F\u56FE\u7247/\u5927\u8D44\u6E90\u52A0\u8F7D");
  }
  if (metrics.longTasks > 3) {
    refs.push({
      kind: "performance",
      severity: "warning",
      message: `\u4E3B\u7EBF\u7A0B\u957F\u4EFB\u52A1 ${metrics.longTasks} \u6B21\uFF08JS \u53EF\u80FD\u963B\u585E\u6E32\u67D3\uFF09`,
      timestamp: Date.now()
    });
    suggestions.push("\u5B58\u5728\u957F\u4EFB\u52A1\u963B\u585E\u4E3B\u7EBF\u7A0B\uFF0C\u68C0\u67E5\u540C\u6B65\u811A\u672C/\u5BC6\u96C6\u8BA1\u7B97");
  }
  if (metrics.resources.totalBytes > 5 * 1024 * 1024) {
    refs.push({
      kind: "performance",
      severity: "info",
      message: `\u9875\u9762\u8D44\u6E90\u603B\u91CF\u8F83\u5927: ${(metrics.resources.totalBytes / 1024 / 1024).toFixed(1)}MB`,
      timestamp: Date.now()
    });
  }
  return { refs, suggestions };
}
function summarize(report) {
  const issues = [];
  const suggestions = [];
  const consoleErrors = report.console.filter((c) => c.severity === "error");
  for (const e of consoleErrors) {
    issues.push({ category: "console", severity: "error", message: e.message });
  }
  if (consoleErrors.length) suggestions.push(`\u63A7\u5236\u53F0\u6709 ${consoleErrors.length} \u6761\u9519\u8BEF\uFF0C\u53EF\u80FD\u662F JS \u5F02\u5E38\u6216\u8D44\u6E90\u52A0\u8F7D\u5931\u8D25`);
  for (const e of report.jsExceptions) {
    issues.push({ category: "js-exception", severity: "error", message: e.message });
  }
  if (report.jsExceptions.length) suggestions.push("\u9875\u9762\u629B\u51FA\u4E86 JS \u672A\u6355\u83B7\u5F02\u5E38\uFF0C\u68C0\u67E5\u5BF9\u5E94\u5806\u6808");
  const netFailed = report.network.filter((n) => n.severity === "error");
  for (const n of netFailed) issues.push({ category: "network", severity: "error", message: n.message });
  const netWarn = report.network.filter((n) => n.severity === "warning");
  for (const n of netWarn) issues.push({ category: "network", severity: "warning", message: n.message });
  for (const d of report.dom) {
    issues.push({ category: "dom", severity: d.severity === "error" ? "error" : "warning", message: d.message });
  }
  const domBlank = report.dom.filter((d) => d.severity === "error");
  if (domBlank.length) suggestions.push("\u9875\u9762\u7591\u4F3C\u7A7A\u767D/\u672A\u6E32\u67D3\uFF0C\u68C0\u67E5\u6302\u8F7D\u8282\u70B9\u4E0E\u521D\u59CB\u5316\u811A\u672C\uFF08\u53EF\u80FD JS \u62A5\u9519\u963B\u65AD\u6574\u6811\u6E32\u67D3\uFF09");
  for (const p of report.performance) {
    if (p.severity === "warning") issues.push({ category: "performance", severity: "warning", message: p.message });
  }
  const unique = [...new Set(suggestions)];
  return {
    healthy: issues.filter((i) => i.severity === "error").length === 0,
    issues: issues.slice(0, 15),
    suggestions: unique.slice(0, 8)
  };
}
var init_analyzer = __esm({
  "packages/diagnosis/src/analyzer.ts"() {
    "use strict";
  }
});

// packages/diagnosis/src/types.ts
var init_types = __esm({
  "packages/diagnosis/src/types.ts"() {
    "use strict";
  }
});

// packages/diagnosis/src/index.ts
var src_exports = {};
__export(src_exports, {
  DiagnosisCenter: () => DiagnosisCenter,
  analyzeNetwork: () => analyzeNetwork,
  analyzePerformance: () => analyzePerformance,
  summarize: () => summarize
});
var DiagnosisCenter;
var init_src = __esm({
  "packages/diagnosis/src/index.ts"() {
    init_analyzer();
    init_types();
    init_analyzer();
    DiagnosisCenter = class {
      collectors = [];
      /** 注册采集器（底层引擎提供） */
      register(collector) {
        this.collectors.push(collector);
        return this;
      }
      /** 运行一次完整诊断 */
      async run() {
        const report = {
          console: [],
          network: [],
          dom: [],
          performance: [],
          jsExceptions: [],
          accessibility: []
        };
        const tasks = this.collectors.map(async (c) => {
          const refs = await c.collect();
          return { category: c.category, refs };
        });
        const results = await Promise.allSettled(tasks);
        for (const r of results) {
          if (r.status === "fulfilled") {
            report[r.value.category] = r.value.refs;
          }
        }
        return report;
      }
      /** 获取 AI 可读摘要 */
      async summarize() {
        const report = await this.run();
        return summarize(report);
      }
      /** 便捷：采集网络失败 */
      static flattenErrors(report) {
        return [
          ...report.console.filter((c) => c.severity === "error"),
          ...report.network.filter((n) => n.severity === "error"),
          ...report.jsExceptions,
          ...report.performance.filter((p) => p.severity === "error")
        ];
      }
    };
  }
});

// packages/mcp-server/src/tools.ts
var TOOLS = [
  {
    name: "observe",
    description: "\u83B7\u53D6\u5F53\u524D\u9875\u9762\u7684\u9AD8\u6548\u5FEB\u7167\u3002\u8FD4\u56DE\u7CBE\u7B80\u540E\u7684\u53EF\u4EA4\u4E92\u5143\u7D20\u7D22\u5F15\uFF08\u5E26 ref\uFF09\u4E0E\u9875\u9762\u7EDF\u8BA1\u3002Token \u53CB\u597D\uFF0C\u662F\u7406\u89E3\u9875\u9762\u7684\u9996\u9009\u3002",
    inputSchema: {
      type: "object",
      properties: {
        maxNodes: { type: "number", description: "\u6700\u5927\u8282\u70B9\u6570\uFF08\u9ED8\u8BA4 200\uFF09" },
        maxTextLength: { type: "number", description: "\u5355\u8282\u70B9\u6587\u672C\u6700\u5927\u957F\u5EA6\uFF08\u9ED8\u8BA4 80\uFF09" }
      }
    }
  },
  {
    name: "act",
    description: "\u6267\u884C\u4E00\u4E2A\u7EDF\u4E00\u6D4F\u89C8\u5668\u52A8\u4F5C\uFF08navigate/click/fill/type/select/hover/scroll/press/wait/extract/assert/screenshot/evaluate\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["navigate", "click", "fill", "type", "select", "hover", "scroll", "press", "wait", "extract", "assert", "screenshot", "evaluate"],
          description: "\u52A8\u4F5C\u7C7B\u578B"
        },
        description: { type: "string" },
        // 通用定位
        ref: { type: "string", description: "observe \u8FD4\u56DE\u7684\u5143\u7D20 ref\uFF08\u6700\u7CBE\u786E\uFF09" },
        selector: { type: "string", description: "CSS \u9009\u62E9\u5668" },
        text: { type: "string", description: "\u7CBE\u786E\u6587\u672C\u5B9A\u4F4D" },
        semantic: { type: "string", description: "\u8BED\u4E49\u63CF\u8FF0\u5B9A\u4F4D" },
        // 动作参数
        url: { type: "string" },
        value: { type: "string" },
        key: { type: "string" },
        ms: { type: "number" },
        script: { type: "string" },
        mode: { type: "string" },
        expected: { type: "string" },
        // 截图/滚动/输入/导航细节（供 IDE 的 function calling 完整声明，避免能力被隐藏）
        fullPage: { type: "boolean", description: "screenshot \u65F6\u662F\u5426\u6574\u9875\u622A\u56FE" },
        deltaY: { type: "number", description: "scroll \u65F6\u5782\u76F4\u6EDA\u52A8\u8DDD\u79BB" },
        delay: { type: "number", description: "type \u65F6\u9010\u952E\u8F93\u5165\u5EF6\u8FDF(ms)" },
        waitUntil: { type: "string", enum: ["load", "domcontentloaded", "networkidle", "commit"], description: "navigate \u65F6\u7B49\u5F85\u7B56\u7565" },
        waitForNavigation: { type: "boolean", description: "click \u65F6\u662F\u5426\u7B49\u5F85\u5BFC\u822A\u7A33\u5B9A\uFF08\u70B9\u51FB\u94FE\u63A5\u89E6\u53D1\u8DF3\u8F6C\u65F6\uFF09" }
      },
      required: ["type"]
    }
  },
  {
    name: "diagnose",
    description: "\u8FD0\u884C 5 \u661F\u8C03\u8BD5\u8BCA\u65AD\uFF0C\u91C7\u96C6\u63A7\u5236\u53F0\u9519\u8BEF\u3001\u7F51\u7EDC\u5931\u8D25\u3001JS \u5F02\u5E38\u3001\u6027\u80FD\u6307\u6807\uFF0C\u5E76\u8FD4\u56DE\u5065\u5EB7\u5EA6\u4E0E AI \u53EF\u8BFB\u5EFA\u8BAE\u3002\u52A8\u4F5C\u5931\u8D25\u540E\u81EA\u52A8\u8BCA\u65AD\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "eval",
    description: "\u5728\u9875\u9762\u6CE8\u5165\u6267\u884C JavaScript\uFF0C\u7528\u4E8E\u9AD8\u7EA7\u8BCA\u65AD\u4E0E\u72B6\u6001\u68C0\u67E5\u3002",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string", description: "\u8981\u6267\u884C\u7684 JS \u8868\u8FBE\u5F0F/\u8BED\u53E5" } },
      required: ["script"]
    }
  },
  {
    name: "screenshot",
    description: "\u622A\u53D6\u5F53\u524D\u9875\u9762\uFF08\u53EF\u6574\u9875\uFF09\uFF0C\u8FD4\u56DE base64 \u56FE\u7247\uFF0C\u7528\u4E8E\u89C6\u89C9\u786E\u8BA4\u3002\u622A\u56FE\u4F1A\u4F5C\u4E3A\u56FE\u7247\u4E8B\u4EF6\u5199\u5165\u4F1A\u8BDD\u65E5\u5FD7\uFF0C\u4F9B\u591A\u6A21\u6001 AI \u6D88\u8D39\u3002",
    inputSchema: {
      type: "object",
      properties: {
        fullPage: { type: "boolean", description: "\u662F\u5426\u6574\u9875\u622A\u56FE" },
        caption: { type: "string", description: "\u622A\u56FE\u8BF4\u660E\uFF08\u5199\u5165\u65E5\u5FD7\u4E8B\u4EF6\uFF09" }
      }
    }
  },
  {
    name: "session_log",
    description: "\u83B7\u53D6\u5F53\u524D\u4F1A\u8BDD\u7684\u4E8B\u4EF6\u65E5\u5FD7\u6D41\uFF08\u52A8\u4F5C/\u8BCA\u65AD/\u9519\u8BEF/\u622A\u56FE\u8F68\u8FF9\uFF09\u3002\u8FD9\u662F AI \u534F\u4F5C\u7684\u8FFD\u8E2A\u80FD\u529B\uFF1A\u8BA9\u5916\u90E8 AI \u770B\u5230\u300E\u53D1\u751F\u4E86\u4EC0\u4E48 + \u4E3A\u4EC0\u4E48\u5931\u8D25 + \u5EFA\u8BAE\u300F\u3002format=json \u8FD4\u56DE\u7ED3\u6784\u5316\u4E8B\u4EF6\uFF0C\u9ED8\u8BA4\u8FD4\u56DE markdown\u3002",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["markdown", "json"], description: "\u8F93\u51FA\u683C\u5F0F\uFF0C\u9ED8\u8BA4 markdown" },
        title: { type: "string", description: "markdown \u62A5\u544A\u6807\u9898" }
      }
    }
  },
  {
    name: "close",
    description: "\u5173\u95ED\u6D4F\u89C8\u5668\uFF0C\u7ED3\u675F\u4F1A\u8BDD\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "stealth_status",
    description: "\u67E5\u770B\u9632\u68C0\u6D4B\uFF08Stealth\uFF09\u6A21\u5757\u72B6\u6001\uFF1A\u662F\u5426\u542F\u7528\u3001\u7EA7\u522B\u3001UA \u7B56\u7565\u7B49\u3002\u9632\u68C0\u6D4B\u7528\u4E8E\u907F\u514D\u88AB\u76EE\u6807\u7AD9\u70B9\u8BC6\u522B\u4E3A\u722C\u866B\u800C\u9650\u901F/\u5C01\u7981\u3002",
    inputSchema: { type: "object", properties: {} }
  }
];
function okResult(text, structured) {
  return { ok: true, content: [{ type: "text", text }], structured };
}
function errResult(text) {
  return { ok: false, content: [{ type: "text", text }], isError: true };
}

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask2) {
    const shape = {};
    for (const key of util.objectKeys(mask2)) {
      if (mask2[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask2) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask2[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask2) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask2 && !mask2[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask2) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask2 && !mask2[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// packages/core/src/actions.ts
var BaseActionSchema = external_exports.object({
  /** 动作类型 */
  type: external_exports.enum([
    "navigate",
    "click",
    "fill",
    "type",
    "select",
    "hover",
    "scroll",
    "press",
    "wait",
    "screenshot",
    "evaluate",
    "assert",
    "extract",
    "snapshot"
  ]),
  /** 动作用途描述（供 AI / 日志 / 回放） */
  description: external_exports.string().optional(),
  /** 语义目标（自然语言，供 AI 层解析） */
  intent: external_exports.string().optional(),
  /** 是否等待动作稳定后再返回 */
  waitUntilStable: external_exports.boolean().default(true)
});
var NavigateActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("navigate"),
  url: external_exports.string().url(),
  /** 等待网络空闲 */
  waitUntil: external_exports.enum(["load", "domcontentloaded", "networkidle", "commit"]).default("networkidle")
});
var ClickActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("click"),
  // 定位方式（按优先级尝试）
  selector: external_exports.string().optional(),
  // 语义目标文本（借鉴 Browser-Use，用文本定位）
  text: external_exports.string().optional(),
  // AI 从快照中返回的 ref（高效精确定位，借鉴 Stagehand XPath / AI locator）
  ref: external_exports.string().optional(),
  // AI 返回的语义定位描述
  semantic: external_exports.string().optional(),
  /** 点击按钮 */
  button: external_exports.enum(["left", "right", "middle"]).default("left"),
  /** 点击次数 */
  clickCount: external_exports.number().int().min(1).max(3).default(1),
  /** 强制忽略可操作性检查 */
  force: external_exports.boolean().default(false),
  /** 点击后是否等待页面导航稳定（点击链接触发跳转时，等待新页面加载完成再返回）。
   *  默认 true，确保 AI 点击跳转后读到的是稳定后的页面，而非旧页面。 */
  waitForNavigation: external_exports.boolean().default(true)
});
var FillActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("fill"),
  selector: external_exports.string().optional(),
  text: external_exports.string().optional(),
  ref: external_exports.string().optional(),
  semantic: external_exports.string().optional(),
  value: external_exports.string()
  /** 输入模式：fill 即时填充 / type 逐键模拟 */
});
var ExtractActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("extract"),
  selector: external_exports.string().optional(),
  text: external_exports.string().optional(),
  ref: external_exports.string().optional(),
  semantic: external_exports.string().optional(),
  /** 结构化提取的 schema 描述 */
  schema: external_exports.record(external_exports.string(), external_exports.any()).optional()
});
var AssertActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("assert"),
  selector: external_exports.string().optional(),
  text: external_exports.string().optional(),
  ref: external_exports.string().optional(),
  semantic: external_exports.string().optional(),
  /** 断言方式 */
  mode: external_exports.enum(["visible", "exists", "hidden", "text-contains", "value-equals", "enabled"]).default("visible"),
  expected: external_exports.string().optional()
});
var ScreenshotActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("screenshot"),
  fullPage: external_exports.boolean().default(false),
  /** 截图区域（可选，用于调试定位） */
  clip: external_exports.object({
    x: external_exports.number(),
    y: external_exports.number(),
    width: external_exports.number(),
    height: external_exports.number()
  }).optional()
});
var HoverActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("hover"),
  selector: external_exports.string().optional(),
  text: external_exports.string().optional(),
  ref: external_exports.string().optional(),
  semantic: external_exports.string().optional()
});
var ScrollActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("scroll"),
  deltaX: external_exports.number().default(0),
  deltaY: external_exports.number().default(600)
});
var WaitActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("wait"),
  ms: external_exports.number().int().min(0).default(1e3)
});
var EvaluateActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("evaluate"),
  script: external_exports.string()
});
var PressActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("press"),
  key: external_exports.string()
});
var TypeActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("type"),
  selector: external_exports.string().optional(),
  text: external_exports.string().optional(),
  ref: external_exports.string().optional(),
  value: external_exports.string(),
  delay: external_exports.number().int().min(0).default(0)
});
var SelectActionSchema = BaseActionSchema.extend({
  type: external_exports.literal("select"),
  selector: external_exports.string().optional(),
  ref: external_exports.string().optional(),
  value: external_exports.string()
});
var UnifiedActionSchema = external_exports.discriminatedUnion("type", [
  NavigateActionSchema,
  ClickActionSchema,
  FillActionSchema,
  TypeActionSchema,
  SelectActionSchema,
  HoverActionSchema,
  ScrollActionSchema,
  WaitActionSchema,
  EvaluateActionSchema,
  PressActionSchema,
  ExtractActionSchema,
  AssertActionSchema,
  ScreenshotActionSchema
]);

// packages/core/src/session.ts
var SessionMachine = class {
  state;
  constructor() {
    this.state = {
      phase: "idle",
      steps: 0,
      startedAt: Date.now()
    };
  }
  get snapshot() {
    return this.state;
  }
  transition(next, patch) {
    this.state = {
      ...this.state,
      ...patch,
      phase: next
    };
    if (next === "acting" || next === "navigating" || next === "observing" || next === "extracting") {
      this.state.steps += 1;
    }
  }
  setUrl(url) {
    this.state.url = url;
  }
  setError(error) {
    this.state.error = error;
    this.state.phase = "error";
  }
  /** 重置会话（供下一轮复用同一浏览器实例） */
  reset() {
    this.state = {
      phase: "idle",
      steps: 0,
      startedAt: Date.now()
    };
  }
};

// packages/core/src/forge.ts
var ForgeBrowser = class {
  constructor(engine, opts = {}) {
    this.engine = engine;
    this.opts = {
      timeoutMs: 3e4,
      snapshotOptions: { maxNodes: 200, maxTextLength: 80, withSelectors: true },
      autoDiagnoseOnError: true,
      ...opts
    };
  }
  engine;
  session = new SessionMachine();
  opts;
  diagnosticsCache = {
    console: [],
    network: [],
    dom: [],
    performance: [],
    jsExceptions: [],
    accessibility: []
  };
  get engineName() {
    return this.engine.name;
  }
  /** 启动 */
  async start() {
    await this.engine.init();
    this.session.transition("idle");
  }
  /** 停止 */
  async stop() {
    await this.engine.close();
    this.session.transition("done");
  }
  /**
   * 执行统一动作。
   * 失败时自动触发诊断采集，返回带诊断引用的结果。
   */
  async act(action) {
    const t0 = Date.now();
    this.session.transition("acting");
    try {
      const result = await this.engine.execute(action);
      result.durationMs = Date.now() - t0;
      this.session.setUrl(result.summary.includes("http") ? result.summary : this.session.snapshot.url ?? "");
      if (result.ok) {
        this.session.transition("acting", { lastAction: action.type });
        result.diagnostics = await this.engine.diagnose().then(
          (d) => [
            ...d.console.filter((c) => c.severity === "error"),
            ...d.network.filter((n) => n.severity === "error"),
            ...d.jsExceptions
          ].slice(0, 8)
        );
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result = {
        ok: false,
        type: action.type,
        summary: `\u52A8\u4F5C\u6267\u884C\u5931\u8D25: ${message}`,
        durationMs: Date.now() - t0,
        error: message
      };
      if (this.opts.autoDiagnoseOnError) {
        const report = await this.captureDiagnostics();
        result.diagnostics = [
          ...report.console,
          ...report.network,
          ...report.dom,
          ...report.jsExceptions,
          ...report.performance
        ].slice(0, 10);
      }
      this.session.setError(message);
      return result;
    }
  }
  /** 获取页面快照（供 AI 观察页面） */
  async observe(opts) {
    this.session.transition("observing");
    const snap = await this.engine.snapshot(opts ?? this.opts.snapshotOptions);
    this.session.transition("observing", { lastSnapshotRef: `${snap.url}#${snap.timestamp}` });
    return snap;
  }
  /** 采集全量调试诊断（5 星能力核心） */
  async captureDiagnostics() {
    this.session.transition("diagnosing");
    const raw = await this.engine.diagnose();
    this.diagnosticsCache = {
      console: raw.console ?? [],
      network: raw.network ?? [],
      dom: raw.dom ?? [],
      performance: raw.performance ?? [],
      jsExceptions: raw.jsExceptions ?? [],
      accessibility: raw.accessibility ?? []
    };
    this.session.transition("acting");
    return this.diagnosticsCache;
  }
  /** 最近一次诊断报告 */
  get lastDiagnostics() {
    return this.diagnosticsCache;
  }
  /** 注入执行 JS（高级诊断/评估） */
  async eval(script) {
    return this.engine.evaluate(script);
  }
};

// packages/engines/src/locator.ts
var INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "label"
].join(", ");
var ElementLocator = class {
  constructor(page, semanticResolver) {
    this.page = page;
    this.semanticResolver = semanticResolver;
  }
  page;
  semanticResolver;
  /**
   * 根据动作参数定位元素，多策略依次回退。
   * 找不到时抛出带诊断提示的错误。
   */
  async locate(opts) {
    const { ref, selector, text, semantic } = opts;
    if (ref) {
      const byRef = this.locateByRef(ref);
      if (await byRef.count()) {
        return { locator: byRef.first(), strategy: "ref", anchorSelector: await this.toCss(byRef.first()) };
      }
    }
    if (selector) {
      const loc = this.page.locator(selector);
      if (await loc.count()) {
        return { locator: loc.first(), strategy: "selector", anchorSelector: selector };
      }
    }
    if (text) {
      const byText = this.locateByText(text);
      if (await byText.count()) {
        return {
          locator: byText.first(),
          strategy: "text",
          anchorSelector: await this.toCss(byText.first())
        };
      }
    }
    if (semantic) {
      const bySemantic = this.locateBySemantic(semantic);
      if (await bySemantic.count()) {
        return {
          locator: bySemantic.first(),
          strategy: "semantic",
          anchorSelector: await this.toCss(bySemantic.first())
        };
      }
      if (this.semanticResolver) {
        const resolved = await this.semanticResolver.resolve(semantic);
        if (resolved?.ref || resolved?.selector || resolved?.text) {
          const byResolved = resolved.selector ? this.page.locator(resolved.selector) : resolved.text ? this.locateByText(resolved.text) : this.locateByRef(resolved.ref);
          if (await byResolved.count()) {
            return {
              locator: byResolved.first(),
              strategy: "semantic",
              anchorSelector: resolved.selector || await this.toCss(byResolved.first())
            };
          }
        }
      }
    }
    throw new Error(
      `\u65E0\u6CD5\u5B9A\u4F4D\u5143\u7D20\uFF1Aref=${ref ?? "-"} selector=${selector ?? "-"} text=${text ?? "-"} semantic=${semantic ?? "-"}. \u5EFA\u8BAE\u8C03\u7528 observe() \u83B7\u53D6\u6700\u65B0\u5FEB\u7167\u540E\u91CD\u8BD5\uFF0C\u6216\u4F7F\u7528 diagnose() \u68C0\u67E5 DOM \u72B6\u6001\u3002`
    );
  }
  /** 通过快照 ref 定位：ref 内嵌了选择器信息（data-forge-ref） */
  locateByRef(ref) {
    return this.page.locator(`[data-forge-ref="${ref}"], [data-forge-ref*="${ref}"]`);
  }
  /** 文本定位：在可交互元素内查找包含指定文本者 */
  locateByText(text) {
    return this.page.locator(INTERACTIVE_SELECTOR).filter({ hasText: text });
  }
  /** 语义定位：尝试 aria-label / placeholder / title */
  locateBySemantic(semantic) {
    return this.page.locator(`${INTERACTIVE_SELECTOR}[aria-label*="${semantic}"], ${INTERACTIVE_SELECTOR}[placeholder*="${semantic}"], ${INTERACTIVE_SELECTOR}[title*="${semantic}"]`).first();
  }
  /** 将 locator 转成唯一 CSS 选择器（用于诊断锚定） */
  async toCss(loc) {
    try {
      return await loc.evaluate((el) => {
        const parts = [];
        let cur = el;
        while (cur && cur.nodeType === 1 && parts.length < 5) {
          let seg = cur.tagName.toLowerCase();
          if (cur.id) {
            seg += `#${cur.id}`;
            parts.unshift(seg);
            break;
          }
          if (cur.classList.length) {
            seg += "." + Array.from(cur.classList).slice(0, 2).join(".");
          }
          parts.unshift(seg);
          cur = cur.parentElement;
        }
        return parts.join(" > ");
      });
    } catch {
      return "";
    }
  }
};

// packages/engines/src/snapshot.ts
var ATTR_WHITELIST = ["id", "class", "name", "type", "value", "href", "placeholder", "title", "aria-label", "role", "data-testid", "src", "alt", "checked", "selected", "disabled", "target"];
var TEXT_TAGS = /* @__PURE__ */ new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "OPTION", "LI", "TD", "TH", "SPAN", "LABEL", "CAPTION", "SUMMARY"]);
var PRUNE_TAGS = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "HEAD", "META", "LINK", "SVG"]);
var INTERACTIVE_TAGS = /* @__PURE__ */ new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "OPTION", "SUMMARY"]);
var INTERACTIVE_ROLES = /* @__PURE__ */ new Set(["button", "link", "textbox", "combobox", "checkbox", "radio", "tab", "menuitem"]);
var SnapshotBuilder = class {
  constructor(page) {
    this.page = page;
  }
  page;
  async build(opts = {}) {
    const maxNodes = opts.maxNodes ?? 200;
    const maxText = opts.maxTextLength ?? 80;
    const withSelectors = opts.withSelectors ?? true;
    const result = await this.page.evaluate(
      ({ maxNodes: maxNodes2, maxText: maxText2, pruneDeep, includeHidden, withSelectors: withSelectors2, PRUNE_TAGS: PRUNE_TAGS2, TEXT_TAGS: TEXT_TAGS2, ATTR_WHITELIST: ATTR_WHITELIST2, INTERACTIVE_TAGS: INTERACTIVE_TAGS2, INTERACTIVE_ROLES: INTERACTIVE_ROLES2 }) => {
        const out = {
          url: location.href,
          title: document.title,
          readyState: document.readyState,
          totalNodes: 0,
          root: null,
          interactive: []
        };
        let emitted = 0;
        let truncatedNodes = 0;
        const refCounter = { n: 0 };
        const isVisible = (el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
        };
        const isInteractive = (el) => {
          if (INTERACTIVE_TAGS2.includes(el.tagName)) return true;
          const role = el.getAttribute("role");
          return !!role && INTERACTIVE_ROLES2.includes(role);
        };
        const SENSITIVE_INPUT_TYPES = ["password", "token", "secret", "key", "api-key", "apikey"];
        const isSensitiveInput = (el) => {
          if (el.tagName !== "INPUT") return false;
          const t = el.type?.toLowerCase() ?? "";
          const n = ((el.getAttribute("name") || "") + (el.getAttribute("autocomplete") || "")).toLowerCase();
          if (t === "password") return true;
          if (SENSITIVE_INPUT_TYPES.includes(t)) return true;
          return /(password|passwd|token|secret|api[_-]?key|auth)/.test(n);
        };
        const elText = (el) => {
          if (el.tagName === "INPUT") {
            const ph = el.getAttribute("placeholder") || "";
            if (isSensitiveInput(el)) return ph ? `[\u654F\u611F\u8F93\u5165] ${ph}` : "[\u654F\u611F\u8F93\u5165\u5DF2\u9690\u85CF]";
            const v = el.value;
            return v || ph || "";
          }
          if (el.tagName === "SELECT") {
            const sel = el;
            return sel.selectedOptions[0]?.text || "";
          }
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          return t.slice(0, maxText2);
        };
        const walk = (el, depth) => {
          if (emitted >= maxNodes2) {
            truncatedNodes++;
            return null;
          }
          if (PRUNE_TAGS2.includes(el.tagName)) return null;
          if (!includeHidden && !isVisible(el)) return null;
          if (pruneDeep && depth > 25) return null;
          out.totalNodes++;
          emitted++;
          const node = {
            ref: `r${refCounter.n++}`,
            tag: el.tagName.toLowerCase(),
            text: TEXT_TAGS2.includes(el.tagName) ? elText(el) : "",
            attributes: {},
            interactive: isInteractive(el),
            depth
          };
          for (const attr of ATTR_WHITELIST2) {
            let v = el.getAttribute(attr);
            if (v) {
              if (attr === "value" && isSensitiveInput(el)) {
                v = "***REDACTED***";
              }
              node.attributes[attr] = v.slice(0, 60);
            }
          }
          const role = el.getAttribute("role");
          if (role) node.role = role;
          if (withSelectors2 && (node.interactive || node.attributes.id)) {
            el.setAttribute("data-forge-ref", node.ref);
            node.selector = el.id ? `${el.tagName.toLowerCase()}#${el.id}` : `${el.tagName.toLowerCase()}[data-forge-ref="${node.ref}"]`;
          }
          if (node.interactive) {
            out.interactive.push({
              ref: node.ref,
              tag: node.tag,
              text: node.text || elText(el),
              role: role || void 0,
              selector: node.selector
            });
          }
          const children = [];
          for (const child of Array.from(el.children)) {
            const c = walk(child, depth + 1);
            if (c) children.push(c);
          }
          if (children.length) node.children = children;
          return node;
        };
        out.root = walk(document.body, 0);
        return out;
      },
      {
        maxNodes,
        maxText,
        pruneDeep: opts.pruneDeep ?? true,
        includeHidden: opts.includeHidden ?? false,
        withSelectors,
        PRUNE_TAGS: [...PRUNE_TAGS],
        TEXT_TAGS: [...TEXT_TAGS],
        ATTR_WHITELIST: [...ATTR_WHITELIST],
        INTERACTIVE_TAGS: [...INTERACTIVE_TAGS],
        INTERACTIVE_ROLES: [...INTERACTIVE_ROLES]
      }
    );
    const approx = this.estimateTokens(result.root);
    return {
      url: result.url,
      title: result.title,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      readyState: result.readyState,
      stats: {
        totalNodes: result.totalNodes,
        emittedNodes: result.totalNodes - result.interactive.length,
        // 近似
        truncatedNodes: 0,
        approximateTokens: approx
      },
      root: result.root,
      interactive: result.interactive
    };
  }
  estimateTokens(root) {
    let chars = 0;
    const count = (n) => {
      if (!n) return;
      chars += (n.tag?.length ?? 0) + (n.text?.length ?? 0) + JSON.stringify(n.attributes || {}).length;
      (n.children || []).forEach(count);
    };
    count(root);
    return Math.round(chars / 4);
  }
};

// packages/engines/src/diagnostics.ts
init_src();
var ConsoleCollector = class {
  constructor(page, buffer = []) {
    this.page = page;
    this.buffer = buffer;
  }
  page;
  buffer;
  category = "console";
  async collect() {
    const refs = [...this.buffer];
    this.buffer = [];
    return refs;
  }
  /** 由引擎在页面监听时调用 */
  push(text, level) {
    const severity = level === "error" ? "error" : level === "warning" ? "warning" : "info";
    this.buffer.push({
      kind: "console",
      severity,
      message: text.slice(0, 500),
      timestamp: Date.now()
    });
  }
};
var JsExceptionCollector = class {
  constructor(page, buffer = []) {
    this.page = page;
    this.buffer = buffer;
  }
  page;
  buffer;
  category = "js-exception";
  async collect() {
    const refs = [...this.buffer];
    this.buffer = [];
    return refs;
  }
  push(error) {
    this.buffer.push({
      kind: "js-exception",
      severity: "error",
      message: error.message.slice(0, 500),
      detail: { stack: error.stack?.slice(0, 1200) },
      timestamp: Date.now()
    });
  }
};
var NetworkCollector = class {
  constructor(page, records = []) {
    this.page = page;
    this.records = records;
  }
  page;
  records;
  category = "network";
  async collect() {
    const { refs } = analyzeNetwork(this.records);
    this.records = [];
    return refs;
  }
  /** 由引擎在请求完成时调用 */
  record(record) {
    this.records.push(record);
  }
};
var PerformanceCollector = class {
  constructor(page) {
    this.page = page;
  }
  page;
  category = "performance";
  async collect() {
    try {
      const metrics = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const paint = performance.getEntriesByType("paint");
        const lcpEntry = performance.getEntriesByType("largest-contentful-paint").pop();
        const resources = performance.getEntriesByType("resource");
        const longTasks = performance.getEntriesByType ? performance.getEntriesByType("longtask").length : 0;
        return {
          ttfb: nav ? nav.responseStart - nav.requestStart : 0,
          domContentLoaded: nav ? nav.domContentLoadedEventStart - nav.startTime : 0,
          loadEvent: nav ? nav.loadEventEnd - nav.startTime : 0,
          fcp: paint.find((p) => p.name === "first-contentful-paint")?.startTime,
          lcp: lcpEntry?.startTime,
          resources: {
            count: resources.length,
            totalBytes: resources.reduce((s, r) => s + (r.transferSize || 0), 0)
          },
          longTasks
        };
      });
      const { refs } = analyzePerformance(metrics);
      return refs;
    } catch {
      return [];
    }
  }
};
var DomCollector = class {
  constructor(page) {
    this.page = page;
  }
  page;
  category = "dom";
  async collect() {
    const refs = [];
    try {
      const state = await this.page.evaluate(() => {
        const body = document.body;
        const hasBody = !!body && body.childElementCount > 0;
        const visible = Array.from(document.querySelectorAll("a,button,input,select,textarea,[role]")).filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
        }).length;
        const root = document.getElementById("root") || document.getElementById("app");
        return {
          hasBody,
          visibleInteractive: visible,
          hasMount: root ? root.childElementCount > 0 : null,
          bodyTextLen: (document.body?.innerText || "").trim().length
        };
      });
      const blank = state.hasBody === false || state.visibleInteractive === 0 && state.bodyTextLen === 0;
      if (blank) {
        refs.push({
          kind: "dom",
          severity: "error",
          message: `\u9875\u9762\u7591\u4F3C\u7A7A\u767D/\u672A\u6E32\u67D3\uFF1Abody \u5B50\u5143\u7D20=${state.hasBody}\uFF0C\u53EF\u89C1\u4EA4\u4E92\u5143\u7D20=${state.visibleInteractive}\uFF0C\u6B63\u6587=${state.bodyTextLen} \u5B57\u7B26`,
          detail: { hasMount: state.hasMount },
          timestamp: Date.now()
        });
      } else if (state.visibleInteractive === 0) {
        refs.push({
          kind: "dom",
          severity: "warning",
          message: `\u9875\u9762\u65E0\u53EF\u89C1\u53EF\u4EA4\u4E92\u5143\u7D20\uFF08\u6B63\u6587 ${state.bodyTextLen} \u5B57\u7B26\uFF09\uFF0C\u53EF\u80FD\u9700\u767B\u5F55\u6216\u5143\u7D20\u88AB\u906E\u6321`,
          timestamp: Date.now()
        });
      }
    } catch {
    }
    return refs;
  }
};
var PlaywrightDiagnostics = class {
  constructor(page) {
    this.page = page;
    this.console = new ConsoleCollector(this.page);
    this.jsExceptions = new JsExceptionCollector(this.page);
    this.network = new NetworkCollector(this.page);
    this.performance = new PerformanceCollector(this.page);
    this.dom = new DomCollector(this.page);
    this.wire();
  }
  page;
  console;
  jsExceptions;
  network;
  performance;
  dom;
  wire() {
    this.page.on("console", (msg) => this.console.push(msg.text(), msg.type()));
    this.page.on("pageerror", (err) => this.jsExceptions.push(err));
    this.page.on("requestfailed", (req) => {
      this.network.record({
        url: req.url(),
        method: req.method(),
        status: 0,
        error: req.failure()?.errorText || "failed",
        durationMs: 0
      });
    });
    this.page.on("response", (res) => {
      const req = res.request();
      this.network.record({
        url: req.url(),
        method: req.method(),
        status: res.status(),
        statusText: res.statusText(),
        mimeType: res.headers()["content-type"],
        durationMs: 0
      });
    });
  }
  collectors() {
    return [this.console, this.jsExceptions, this.network, this.performance, this.dom];
  }
};

// packages/engines/src/playwright-engine.ts
import { chromium } from "playwright";

// packages/ai-layer/src/semantic-locator.ts
var IGNORE_WORDS = /* @__PURE__ */ new Set(["\u8BF7", "\u70B9\u51FB", "\u8F93\u5165", "\u9009\u62E9", "\u627E\u5230", "\u90A3\u4E2A", "\u8FD9\u4E2A", "\u7684", "\u6309\u94AE", "\u94FE\u63A5", "the", "click", "button", "link", "please"]);
function locateBySemantic(snapshot, semantic) {
  const q = normalize(semantic);
  const qTokens = tokenize(q);
  let best = { score: 0, note: "\u672A\u627E\u5230\u5339\u914D" };
  for (const el of snapshot.interactive) {
    const targetText = normalize(el.text);
    if (targetText && targetText.includes(q)) {
      const score2 = 100 + q.length;
      if (score2 > best.score) best = { ref: el.ref, text: el.text, selector: el.selector, score: score2, note: "\u6587\u672C\u5305\u542B\u5339\u914D" };
      continue;
    }
    const targetTokens = tokenize(targetText);
    const meaningfulQ = qTokens.filter(isMeaningful);
    const meaningfulTarget = targetTokens.filter(isMeaningful);
    if (!meaningfulTarget.length) continue;
    const overlap = meaningfulQ.filter((w) => meaningfulTarget.includes(w)).length;
    const score = Math.round(overlap / Math.max(meaningfulQ.length, 1) * 100);
    if (score > 0 && score > best.score) {
      best = { ref: el.ref, text: el.text, selector: el.selector, score, note: "\u8BCD\u5143\u91CD\u53E0\u5339\u914D" };
    }
  }
  return best;
}
function tokenize(s) {
  const tokens = [];
  for (const m of s.matchAll(/[a-z0-9]+/gi)) tokens.push(m[0]);
  for (const m of s.matchAll(/[\u4e00-\u9fff]+/g)) {
    for (const ch of m[0]) tokens.push(ch);
  }
  return tokens;
}
function isMeaningful(w) {
  if (IGNORE_WORDS.has(w)) return false;
  if (/^[\u4e00-\u9fff]$/.test(w)) return true;
  return w.length > 1;
}
function normalize(s) {
  return s.toLowerCase().replace(/[，。！？、；：""''（）()]/g, " ").trim();
}

// packages/stealth/src/stealth.ts
var DEFAULTS = {
  level: "basic",
  humanTypingDelay: [30, 90],
  humanActionDelay: [200, 600],
  humanMouseTrajectory: true,
  userAgent: void 0,
  extraArgs: []
};
var StealthManager = class {
  options;
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      level: options.level ?? DEFAULTS.level,
      userAgent: options.userAgent ?? DEFAULTS.userAgent,
      humanTypingDelay: options.humanTypingDelay ?? DEFAULTS.humanTypingDelay,
      humanActionDelay: options.humanActionDelay ?? DEFAULTS.humanActionDelay,
      humanMouseTrajectory: options.humanMouseTrajectory ?? DEFAULTS.humanMouseTrajectory,
      extraArgs: options.extraArgs ?? DEFAULTS.extraArgs
    };
  }
  /** 是否启用 */
  get isEnabled() {
    return this.options.enabled;
  }
  /** 浏览器启动参数（仅当启用时返回，否则返回空数组，保持默认干净） */
  buildLaunchArgs() {
    if (!this.options.enabled) return [];
    const args = [
      // 禁用自动化控制标志（这是最重要的反检测点）
      "--disable-blink-features=AutomationControlled",
      "--disable-blink-features=AutomationControlled,IdleDetection",
      // 移除自动化相关的默认行为
      "--disable-automation",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      "--disable-extensions-except=/dev/null",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-component-update",
      "--disable-domain-reliability",
      "--disable-client-side-phishing-detection",
      // 禁用无头模式特有的可检测特征
      "--disable-infobars",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-position=0,0",
      "--lang=en-US,en"
    ];
    if (this.options.extraArgs?.length) args.push(...this.options.extraArgs);
    return args;
  }
  /**
   * 反指纹注入脚本 —— 在页面上下文中执行，用于伪装浏览器指纹。
   * 返回的脚本会在每个新页面创建时注入。
   */
  buildInitScript() {
    if (!this.options.enabled) return "";
    return `(() => {
  // \u2500\u2500\u2500 1. \u9690\u85CF navigator.webdriver\uFF08\u6700\u7ECF\u5178\u7684\u68C0\u6D4B\u70B9\uFF09 \u2500\u2500\u2500
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // \u2500\u2500\u2500 2. \u4F2A\u88C5 plugins\uFF08\u771F\u5B9E\u6D4F\u89C8\u5668\u901A\u5E38\u6709 PDF \u67E5\u770B\u5668\u7B49\u63D2\u4EF6\uFF09 \u2500\u2500\u2500
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const pluginList = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
      ];
      const result = { length: pluginList.length, item: (i) => pluginList[i], namedItem: (n) => pluginList.find(p => p.name === n) || null };
      for (const p of pluginList) result[p.name] = p;
      return result;
    }
  });

  // \u2500\u2500\u2500 3. \u4F2A\u88C5 languages\uFF08\u4E0E\u771F\u5B9E Chrome \u5BF9\u9F50\uFF09 \u2500\u2500\u2500
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'zh-CN'] });

  // \u2500\u2500\u2500 4. \u9690\u85CF AutomationControlled \u75D5\u8FF9 \u2500\u2500\u2500
  if (window.chrome) {
    // \u786E\u4FDD chrome.runtime \u5B58\u5728\uFF08\u771F\u5B9E\u6D4F\u89C8\u5668\u4E2D\u8BE5\u5BF9\u8C61\u5B58\u5728\uFF09
    if (!window.chrome.runtime) {
      Object.defineProperty(window.chrome, 'runtime', { value: {} });
    }
  }

  // \u2500\u2500\u2500 5. \u4FEE\u6539 permissions \u62A5\u544A\uFF08\u907F\u514D\u8FD4\u56DE denied \u88AB\u8BC6\u522B\uFF09 \u2500\u2500\u2500
  const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) => (
      parameters && parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );
  }

  // \u2500\u2500\u2500 6. \u5168\u7EA7 stealth\uFF1A\u66F4\u591A\u6307\u7EB9\u4F2A\u88C5 \u2500\u2500\u2500
  ${this.options.level === "full" ? `
  // \u4F2A\u88C5 console.debug \u4E0D\u4EA7\u751F\u552F\u4E00\u8C03\u7528\u6808
  // \u4F2A\u88C5 window.outerWidth/outerHeight\uFF08headless \u6D4F\u89C8\u5668\u7A97\u53E3\u5C3A\u5BF8\u5DEE\u5F02\uFF09
  Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth || 1920 });
  Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight || 1080 });

  // \u4F2A\u88C5 screen \u53C2\u6570
  Object.defineProperty(window.screen, 'colorDepth', { get: () => 24 });
  Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24 });

  // \u4F2A\u88C5\u7F6E\u89E6\u6478\u652F\u6301\uFF08\u907F\u514D headless \u68C0\u6D4B\u5230\u65E0\u89E6\u6478\u80FD\u529B\uFF09
  if (!('ontouchstart' in window)) {
    Object.defineProperty(window, 'ontouchstart', { value: null });
  }

  // \u4F2A\u88C5 DeviceMemory \u548C HardwareConcurrency
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

  // \u4F2A\u88C5 WebGL \u6E32\u67D3\u5668\uFF08\u907F\u514D\u66B4\u9732 SwiftShader \u7B49\u65E0\u5934\u6E32\u67D3\u5668\uFF09
  try {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Google Inc. (NVIDIA)';
      if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      return getParameter.call(this, parameter);
    };
  } catch (e) {}
  ` : ""}
})();`;
  }
  /**
   * 人类行为模拟 —— 生成随机的人类化动作间隔。
   * 调用方在动作之间使用该间隔，模拟人的操作节奏。
   */
  humanDelay() {
    if (!this.options.enabled) return 0;
    const [min, max] = this.options.humanActionDelay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  /** 人类打字延迟（type 动作时逐键之间的随机间隔） */
  humanTypingDelayMs() {
    if (!this.options.enabled) return 0;
    const [min, max] = this.options.humanTypingDelay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  /**
   * 生成人类化的鼠标移动路径（贝塞尔曲线插值）。
   * 返回一组 [[x,y], ...] 坐标序列，供调用方依次移动鼠标。
   */
  humanMousePath(from, to, steps = 12) {
    if (!this.options.enabled || !this.options.humanMouseTrajectory) {
      return [[to.x, to.y]];
    }
    const path = [];
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const controlX = (from.x + to.x) / 2 + (Math.random() - 0.5) * 40;
      const controlY = Math.min(from.y, to.y) - Math.random() * 30;
      const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * controlX + t ** 2 * to.x;
      const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * controlY + t ** 2 * to.y;
      path.push([Math.round(x), Math.round(y)]);
    }
    return path;
  }
  /** 生成唯一签名标识（用于标记 stealth 开启状态） */
  get signature() {
    if (!this.options.enabled) return "stealth-off";
    return `stealth:${this.options.level}:ua=${this.options.userAgent ? "custom" : "default"}`;
  }
};

// packages/engines/src/playwright-engine.ts
var PlaywrightEngine = class {
  name = "playwright+cdp";
  browser;
  context;
  page;
  locator;
  snapshotBuilder;
  diagnostics;
  options;
  /** 防检测管理器 */
  stealth;
  constructor(options = {}) {
    this.options = { headless: true, viewport: { width: 1280, height: 800 }, ...options };
    if (this.options.stealth instanceof StealthManager) {
      this.stealth = this.options.stealth;
    } else if (this.options.stealth) {
      this.stealth = new StealthManager(this.options.stealth);
    }
  }
  /** 当前 stealth 是否启用 */
  get stealthEnabled() {
    return this.stealth?.isEnabled ?? false;
  }
  async init() {
    const launchArgs = this.stealth?.buildLaunchArgs() ?? [];
    if (this.options.connectUrl) {
      this.browser = await chromium.connectOverCDP(this.options.connectUrl);
    } else {
      this.browser = await chromium.launch({
        headless: this.options.headless,
        executablePath: this.options.executablePath,
        args: launchArgs.length ? launchArgs : void 0
      });
    }
    const ctxOptions = { viewport: this.options.viewport };
    if (this.stealth?.isEnabled) {
      const initScript = this.stealth.buildInitScript();
      if (initScript) ctxOptions.initScript = initScript;
      if (this.stealth.options.userAgent) ctxOptions.userAgent = this.stealth.options.userAgent;
    }
    this.context = this.browser.contexts()[0] || await this.browser.newContext(ctxOptions);
    this.page = this.context.pages()[0] || await this.context.newPage();
    this.diagnostics = new PlaywrightDiagnostics(this.page);
    this.snapshotBuilder = new SnapshotBuilder(this.page);
    this.locator = new ElementLocator(this.page, {
      // 语义定位链路：aria/placeholder 兜底失败后，基于快照做中文分词+语义相似度匹配
      resolve: async (semantic) => {
        const snap = await this.snapshotBuilder.build({ maxNodes: 200, maxTextLength: 80 });
        const hit = locateBySemantic(snap, semantic);
        if (hit && (hit.ref || hit.selector)) {
          return { ref: hit.ref, text: hit.text, selector: hit.selector };
        }
        return null;
      }
    });
  }
  async close() {
    await this.browser?.close();
  }
  async execute(action) {
    if (!this.page) throw new Error("\u5F15\u64CE\u672A\u521D\u59CB\u5316\uFF0C\u8BF7\u5148\u8C03\u7528 init()");
    const t0 = Date.now();
    switch (action.type) {
      case "navigate": {
        await this.page.goto(action.url, { waitUntil: action.waitUntil ?? "networkidle", timeout: 3e4 });
        this.diagnostics?.network.record({
          url: action.url,
          method: "NAV",
          status: 200,
          durationMs: Date.now() - t0
        });
        return { ok: true, type: "navigate", summary: `\u5DF2\u5BFC\u822A\u5230 ${action.url}`, durationMs: Date.now() - t0 };
      }
      case "click": {
        const { locator, strategy, anchorSelector } = await this.locator.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic
        });
        const waitForNavigation = action.waitForNavigation ?? true;
        const isLink = await locator.evaluate((el) => el.tagName.toLowerCase() === "a" && !!el.getAttribute("href")).catch(() => false);
        const navPromise = waitForNavigation && isLink ? this.page.waitForNavigation({ waitUntil: "load", timeout: 15e3 }).catch(() => null) : null;
        await locator.click({
          button: action.button,
          clickCount: action.clickCount,
          force: action.force,
          timeout: 15e3
        });
        if (navPromise) await navPromise;
        return {
          ok: true,
          type: "click",
          summary: `\u5DF2\u70B9\u51FB\uFF08\u7B56\u7565=${strategy} \u951A\u70B9=${anchorSelector}${navPromise ? ",\u5DF2\u7B49\u5F85\u5BFC\u822A\u7A33\u5B9A" : ""}\uFF09`,
          durationMs: Date.now() - t0
        };
      }
      case "fill": {
        const { locator, strategy } = await this.locator.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic
        });
        await locator.fill(action.value);
        return {
          ok: true,
          type: "fill",
          summary: `\u5DF2\u586B\u5165\u5185\u5BB9\uFF08\u7B56\u7565=${strategy}\uFF09`,
          durationMs: Date.now() - t0
        };
      }
      case "type": {
        const { locator, strategy } = await this.locator.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text
        });
        await locator.click();
        const delay = action.delay ?? (this.stealth?.isEnabled ? this.stealth.humanTypingDelayMs() : void 0);
        await this.page.keyboard.type(action.value, { delay: delay ?? 0 });
        return {
          ok: true,
          type: "type",
          summary: `\u5DF2\u9010\u952E\u8F93\u5165\uFF08\u7B56\u7565=${strategy}${this.stealth?.isEnabled ? ",stealth\u5EF6\u8FDF" : ""}\uFF09`,
          durationMs: Date.now() - t0
        };
      }
      case "select": {
        const { locator, strategy } = await this.locator.locate({
          ref: action.ref,
          selector: action.selector
        });
        await locator.selectOption(action.value);
        return {
          ok: true,
          type: "select",
          summary: `\u5DF2\u9009\u62E9\u9009\u9879\uFF08\u7B56\u7565=${strategy}\uFF09`,
          durationMs: Date.now() - t0
        };
      }
      case "extract": {
        const { locator } = await this.locator.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic
        });
        const data = await locator.evaluate((el) => {
          const clone = el.cloneNode(true);
          const text = (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();
          return { text: text.slice(0, 2e3) };
        });
        return { ok: true, type: "extract", summary: "\u63D0\u53D6\u5B8C\u6210", data, durationMs: Date.now() - t0 };
      }
      case "assert": {
        const { locator } = await this.locator.locate({
          ref: action.ref,
          selector: action.selector,
          text: action.text,
          semantic: action.semantic
        });
        const count = await locator.count();
        if (count === 0) {
          return { ok: false, type: "assert", summary: `\u65AD\u8A00\u5931\u8D25\uFF1A\u672A\u627E\u5230\u76EE\u6807\u5143\u7D20`, durationMs: Date.now() - t0 };
        }
        const el = locator.first();
        const visible = await el.isVisible().catch(() => false);
        const text = await el.innerText().catch(() => "") || "";
        let pass = true;
        let detail = "";
        switch (action.mode) {
          case "visible":
            pass = visible;
            detail = `\u53EF\u89C1=${visible}`;
            break;
          case "exists":
            pass = true;
            break;
          case "hidden":
            pass = !visible;
            break;
          case "text-contains":
            pass = action.expected ? text.includes(action.expected) : false;
            detail = `\u6587\u672C\u5305\u542B'${action.expected}'=${pass} \u5B9E\u9645='${text.slice(0, 50)}'`;
            break;
          case "enabled":
            pass = await el.isEnabled().catch(() => false);
            break;
          default:
            pass = visible;
        }
        return {
          ok: pass,
          type: "assert",
          summary: `\u65AD\u8A00${pass ? "\u901A\u8FC7" : "\u5931\u8D25"}: ${action.mode} ${detail}`,
          durationMs: Date.now() - t0
        };
      }
      case "screenshot": {
        const buf = action.fullPage ? await this.page.screenshot({ fullPage: true, clip: action.clip }) : await this.page.screenshot({ clip: action.clip });
        const base64 = buf.toString("base64");
        return {
          ok: true,
          type: "screenshot",
          summary: `\u5DF2\u622A\u56FE (${base64.length * 0.75 / 1024}KB, ${base64.length} b64)`,
          data: { base64 },
          durationMs: Date.now() - t0
        };
      }
      case "hover": {
        const { locator } = await this.locator.locate({ ref: action.ref, selector: action.selector });
        await locator.hover();
        return { ok: true, type: "hover", summary: "\u5DF2\u60AC\u505C", durationMs: Date.now() - t0 };
      }
      case "scroll": {
        await this.page.mouse.wheel(0, action.deltaY ?? 600);
        return { ok: true, type: "scroll", summary: "\u5DF2\u6EDA\u52A8", durationMs: Date.now() - t0 };
      }
      case "wait": {
        await this.page.waitForTimeout(action.ms ?? 1e3);
        return { ok: true, type: "wait", summary: "\u5DF2\u7B49\u5F85", durationMs: Date.now() - t0 };
      }
      case "evaluate": {
        const result = await this.page.evaluate(action.script);
        return { ok: true, type: "evaluate", summary: "JS \u6267\u884C\u5B8C\u6210", data: result, durationMs: Date.now() - t0 };
      }
      case "press": {
        await this.page.keyboard.press(action.key ?? "Enter");
        return { ok: true, type: "press", summary: `\u5DF2\u6309\u952E ${action.key}`, durationMs: Date.now() - t0 };
      }
      default: {
        const a = action;
        return { ok: false, type: a.type, summary: `\u4E0D\u652F\u6301\u7684 action: ${a.type}`, durationMs: Date.now() - t0 };
      }
    }
  }
  async snapshot(options) {
    return this.snapshotBuilder.build(options);
  }
  async diagnose() {
    const collectors = this.diagnostics.collectors();
    const collected = await Promise.all(
      collectors.map(async (c) => ({ category: c.category, refs: await c.collect() }))
    );
    const byCat = (cat) => collected.find((c) => c.category === cat)?.refs ?? [];
    return {
      console: byCat("console"),
      network: byCat("network"),
      dom: byCat("dom"),
      performance: byCat("performance"),
      jsExceptions: byCat("js-exception"),
      accessibility: byCat("accessibility")
    };
  }
  async collectConsole() {
    return this.diagnostics.console.collect();
  }
  async collectNetwork() {
    return this.diagnostics.network.collect();
  }
  async evaluate(script) {
    return this.page.evaluate(script);
  }
};

// packages/token/src/index.ts
function compactSnapshot(snapshot, maxInteractive = 40) {
  const parts = [];
  parts.push(`[${snapshot.title}] ${snapshot.url}`);
  const rows = snapshot.interactive.slice(0, maxInteractive).map(
    (el) => `${el.ref}:${el.tag}${el.role ? "[" + el.role + "]" : ""}:"${el.text.slice(0, 60)}"`
  );
  parts.push(rows.join("\n"));
  return parts.join("\n");
}

// packages/mcp-server/src/security.ts
var SENSITIVE_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "client_secret",
  "password",
  "passwd",
  "pwd",
  "apikey",
  "api_key",
  "api-key",
  "auth",
  "authorization",
  "cookie",
  "set-cookie",
  "sessionid",
  "sid",
  "key",
  "private_key",
  "privatekey",
  "signature",
  "credential",
  "credentials",
  "x-api-key",
  "x-auth-token",
  "jwt"
];
function isSensitiveKey(key) {
  const k = key.toLowerCase();
  if (k === "session" || k === "sessionid" || k === "sid") return false;
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}
function mask(value) {
  if (!value) return value;
  if (value.length <= 2) return "****";
  const head = value.slice(0, 2);
  const tail = value.length > 6 ? value.slice(-2) : "";
  return `${head}****${tail} (${value.length} chars)`;
}
function redactDeep(value, depth = 0, maxDepth = 12) {
  if (depth > maxDepth) return void 0;
  if (value === null || value === void 0) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v, depth + 1, maxDepth));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveKey(k)) {
        out[k] = typeof v === "string" ? mask(v) : "***REDACTED***";
      } else {
        out[k] = redactDeep(v, depth + 1, maxDepth);
      }
    }
    return out;
  }
  return value;
}
function redactUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const u = new URL(rawUrl);
    for (const key of [...u.searchParams.keys()]) {
      if (isSensitiveKey(key)) {
        const v = u.searchParams.get(key) ?? "";
        u.searchParams.set(key, mask(v));
      }
    }
    if (u.hash && /(token|access_token|secret|auth)=/i.test(u.hash)) {
      u.hash = "###REDACTED###";
    }
    if (u.username || u.password) {
      u.username = "***";
      u.password = "***";
    }
    return u.toString();
  } catch {
    return rawUrl.replace(
      /([?&](token|password|passwd|secret|api[_-]?key|auth|access_token|refresh_token|client_secret)=)[^&]*/gi,
      "$1***REDACTED***"
    );
  }
}
var DANGEROUS_JS_PATTERNS = [
  { label: "\u6587\u4EF6\u7CFB\u7EDF\u8BBF\u95EE", re: /require\s*\(\s*['"]fs['"]|node:fs|readFile|writeFile|rmSync|unlinkSync/i },
  { label: "\u5B50\u8FDB\u7A0B\u6267\u884C", re: /child_process|execSync|spawnSync|\bexec\s*\(|process\.exec/i },
  { label: "\u7F51\u7EDC\u6E17\u900F", re: /process\.env|__proto__|constructor\s*\(\s*['"]constructor/i },
  { label: "\u6D4F\u89C8\u5668\u6F0F\u6D1E\u5229\u7528", re: /exploit|bypass|bypass.*security|disable.*security|certificate/i }
];
function guardJsScript(script) {
  const blockedReasons = [];
  for (const { label, re } of DANGEROUS_JS_PATTERNS) {
    if (re.test(script)) blockedReasons.push(label);
  }
  return {
    allowed: blockedReasons.length === 0,
    blocked: blockedReasons.length > 0,
    reasons: blockedReasons
  };
}
function redactText(raw) {
  if (!raw) return raw;
  return raw.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1***REDACTED***").replace(/(Authorization\s*[:=]\s*)(?:Bearer\s+)?[A-Za-z0-9._~+/=-]+/gi, "$1***REDACTED***").replace(/([?&](?:token|password|passwd|secret|api[_-]?key|access_token|refresh_token|client_secret|auth)=)[^&\s"']+/gi, "$1***REDACTED***").replace(/(password\s*[:=]\s*['"]?)[^'"\s,;]+/gi, "$1***REDACTED***");
}

// packages/mcp-server/src/logger.ts
var SessionLogger = class {
  sessionId;
  events = [];
  listeners = /* @__PURE__ */ new Set();
  seq = 0;
  maxEvents;
  enabled;
  constructor(opts = {}) {
    this.sessionId = opts.sessionId ?? `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.maxEvents = opts.maxEvents ?? 2e3;
    this.enabled = opts.enabled ?? true;
  }
  /** 订阅实时事件，返回取消订阅函数 */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** 记录一条通用日志事件 */
  log(entry) {
    const event = {
      seq: this.nextSeq(),
      ts: Date.now(),
      level: entry.level ?? "info",
      category: entry.category ?? "log",
      message: entry.message,
      payload: entry.payload,
      sessionId: this.sessionId
    };
    return this.emit(event);
  }
  /** 记录一条标准错误事件（带报错原因与解释，交给外部 AI） */
  error(err) {
    const { message, level, payload, ...error } = err;
    const event = {
      seq: this.nextSeq(),
      ts: Date.now(),
      level: level ?? "error",
      category: "error",
      message,
      error,
      payload,
      sessionId: this.sessionId
    };
    return this.emit(event);
  }
  /** 记录一条截图/图片事件 */
  screenshot(img) {
    const byteLength = img.dataUri.replace(/^data:image\/png;base64,/, "").length;
    const event = {
      seq: this.nextSeq(),
      ts: Date.now(),
      level: "info",
      category: "screenshot",
      message: img.caption ?? `\u622A\u56FE\u5DF2\u91C7\u96C6 (${byteLength * 0.75 / 1024}KB)`,
      image: {
        dataUri: img.dataUri,
        byteLength,
        fullPage: img.fullPage ?? false,
        caption: img.caption
      },
      sessionId: this.sessionId
    };
    return this.emit(event);
  }
  /** 记录系统生命周期事件 */
  system(message, payload) {
    return this.log({ level: "info", category: "system", message, payload });
  }
  /** 记录一次动作执行事件 */
  action(message, payload) {
    return this.log({ level: "info", category: "action", message, payload });
  }
  /** 记录一次诊断事件 */
  diagnose(message, payload) {
    return this.log({ level: "info", category: "diagnose", message, payload });
  }
  /** 获取全部历史事件（快照） */
  toArray() {
    return this.events.slice();
  }
  /** 按类别过滤事件 */
  filter(category) {
    const cats = Array.isArray(category) ? category : [category];
    return this.events.filter((e) => cats.includes(e.category));
  }
  /** 清空事件流 */
  clear() {
    this.events = [];
    this.seq = 0;
  }
  /** 导出为 markdown（供外部 AI / PR 评论 / 制品消费），对消息与 payload 脱敏防令牌泄露 */
  exportMarkdown(opts = {}) {
    const lines = [];
    lines.push(`# ${opts.title ?? "Forge \u4F1A\u8BDD\u4E8B\u4EF6\u65E5\u5FD7"}`);
    lines.push(`**Session**: ${this.sessionId} | **\u4E8B\u4EF6\u6570**: ${this.events.length}`);
    lines.push("");
    for (const e of this.events) {
      const t = new Date(e.ts).toISOString().replace("T", " ").slice(0, 19);
      const tag = `[${e.level.toUpperCase()}/${e.category}]`;
      const msg = redactText(e.message);
      if (e.category === "error") {
        const err = e.error;
        lines.push(`- \`${t}\` **${tag}** ${msg}`);
        lines.push(`  - \u9519\u8BEF\u7801: \`${err.code}\` | \u6839\u56E0: ${err.reason}`);
        if (err.explanation) lines.push(`  - \u539F\u56E0: ${redactText(err.explanation)}`);
        if (err.suggestion) lines.push(`  - \u5EFA\u8BAE: ${redactText(err.suggestion)}`);
      } else if (e.category === "screenshot") {
        const img = e.image;
        lines.push(`- \`${t}\` **${tag}** ${msg}`);
        if (opts.includeScreenshots) {
          lines.push(`  - ![\u622A\u56FE](./forge-event-${e.seq}.png)`);
        }
      } else {
        lines.push(`- \`${t}\` **${tag}** ${msg}`);
      }
      if (e.payload && Object.keys(e.payload).length) {
        const p = JSON.stringify(redactDeep(e.payload));
        if (p.length <= 400) lines.push(`  - payload: \`${p}\``);
      }
    }
    return lines.join("\n");
  }
  /** 生成纯文本执行轨迹（供日志/终端） */
  toTimeline() {
    return this.events.map((e) => {
      const t = new Date(e.ts).toISOString().replace("T", " ").slice(11, 19);
      return `${t} [${e.level}] ${e.category}: ${e.message}`;
    }).join("\n");
  }
  nextSeq() {
    return ++this.seq;
  }
  emit(event) {
    if (!this.enabled) return event;
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(this.events.length - this.maxEvents);
    }
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
      }
    }
    return event;
  }
};

// packages/mcp-server/src/forge-mcp.ts
var ForgeMcp = class {
  constructor(opts = {}) {
    this.opts = opts;
    this.logger = opts.logger ?? new SessionLogger({ maxEvents: opts.maxEvents });
  }
  opts;
  tools = TOOLS;
  /** 会话事件日志器 —— 供外部 AI / IDE 订阅和拉取事件流 */
  logger;
  browser;
  diagnosis;
  /** 生命周期：确保浏览器已就绪 */
  async ensureBrowser() {
    if (!this.browser) {
      const engine = new PlaywrightEngine({
        headless: this.opts.headless ?? true,
        connectUrl: this.opts.connectUrl,
        stealth: this.opts.stealth
      });
      this.browser = new ForgeBrowser(engine);
      await this.browser.start();
    }
    return this.browser;
  }
  /** 核心：分发工具调用 */
  async callTool(name2, args) {
    const t0 = Date.now();
    try {
      this.logger.log({ level: "debug", category: "system", message: `\u8C03\u7528\u5DE5\u5177 ${name2}`, payload: { args: this.safeArgs(args) } });
      let result;
      switch (name2) {
        case "observe": {
          const b = await this.ensureBrowser();
          const snap = await b.observe({ maxNodes: args.maxNodes ?? 200, maxTextLength: args.maxTextLength ?? 80 });
          result = okResult(compactSnapshot(snap), { url: snap.url, title: snap.title, stats: snap.stats });
          this.logger.log({ category: "action", message: `observe ${snap.url} (${snap.stats?.emittedNodes ?? 0} \u53EF\u4EA4\u4E92\u8282\u70B9)` });
          break;
        }
        case "act": {
          const b = await this.ensureBrowser();
          const action = this.normalizeAction(args);
          const actResult = await b.act(action);
          const lines = [`\u52A8\u4F5C: ${actResult.type}`];
          if (actResult.ok) {
            lines.push(`\u2713 ${actResult.summary}`);
            if (actResult.diagnostics?.length) {
              lines.push(`\u26A0 \u52A8\u4F5C\u540E\u68C0\u6D4B\u5230 ${actResult.diagnostics.length} \u6761\u9875\u9762\u5F02\u5E38:`);
              for (const d of actResult.diagnostics.slice(0, 5)) lines.push(`  - [${d.kind}] ${d.message}`);
            }
          } else {
            lines.push(`\u2717 ${actResult.summary}`);
          }
          lines.push(`\u8017\u65F6 ${actResult.durationMs}ms`);
          result = actResult.ok ? okResult(lines.join("\n"), { data: actResult.data }) : errResult(lines.join("\n"));
          if (actResult.ok) {
            this.logger.action(`\u52A8\u4F5C ${actResult.type} \u6210\u529F: ${actResult.summary}`, { type: actResult.type, durationMs: actResult.durationMs });
            if (actResult.diagnostics?.length) {
              this.logger.diagnose(`\u52A8\u4F5C\u540E\u68C0\u6D4B\u5230 ${actResult.diagnostics.length} \u6761\u9875\u9762\u5F02\u5E38`, {
                items: actResult.diagnostics.slice(0, 5).map((d) => ({ kind: d.kind, message: d.message }))
              });
            }
          } else {
            this.logger.error({
              message: `\u52A8\u4F5C ${actResult.type} \u5931\u8D25: ${actResult.summary}`,
              code: this.mapErrorCode(actResult.type),
              reason: this.mapErrorReason(actResult.summary, actResult.diagnostics),
              raw: actResult.summary,
              explanation: this.buildExplanation(actResult.summary, actResult.diagnostics),
              suggestion: this.buildSuggestion(actResult.summary),
              detail: actResult.error,
              findings: (actResult.diagnostics ?? []).slice(0, 5).map((d) => ({
                category: d.kind,
                severity: d.severity,
                message: d.message
              }))
            });
          }
          break;
        }
        case "diagnose": {
          const b = await this.ensureBrowser();
          const report = await b.captureDiagnostics();
          const { summarize: summarize2 } = await Promise.resolve().then(() => (init_src(), src_exports));
          const summary = summarize2(report);
          const lines = [`# \u8BCA\u65AD\u7ED3\u679C (${summary.healthy ? "\u5065\u5EB7" : "\u5B58\u5728\u95EE\u9898"})`];
          if (summary.issues.length === 0) {
            lines.push("\u672A\u53D1\u73B0\u9519\u8BEF\uFF0C\u9875\u9762\u8FD0\u884C\u6B63\u5E38\u3002");
          }
          for (const issue of summary.issues) {
            lines.push(`- [${issue.category}/${issue.severity}] ${issue.message}`);
          }
          if (summary.suggestions.length) {
            lines.push(`
## \u5EFA\u8BAE`);
            summary.suggestions.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
          }
          result = okResult(lines.join("\n"), {
            issues: summary.issues,
            console: report.console.length,
            network: report.network.length,
            dom: report.dom.length,
            jsExceptions: report.jsExceptions.length
          });
          this.logger.diagnose(`\u8BCA\u65AD\u5B8C\u6210: ${summary.healthy ? "\u5065\u5EB7" : `${summary.issues.length} \u6761\u95EE\u9898`}`, {
            healthy: summary.healthy,
            issues: summary.issues.length,
            suggestions: summary.suggestions.length
          });
          break;
        }
        case "eval": {
          const b = await this.ensureBrowser();
          const script = String(args.script);
          const guard = guardJsScript(script);
          if (guard.blocked) {
            result = errResult(
              `eval \u88AB\u5B89\u5168\u62E6\u622A\uFF1A\u811A\u672C\u547D\u4E2D\u9AD8\u5371\u64CD\u4F5C [${(guard.reasons ?? []).join(", ")}]\u3002
\u4E3A\u9632\u63D0\u6743/\u6E17\u900F\uFF0C\u7981\u6B62\u901A\u8FC7 eval \u6CE8\u5165\u6587\u4EF6\u7CFB\u7EDF\u8BBF\u95EE\u3001\u5B50\u8FDB\u7A0B\u6267\u884C\u6216\u7CFB\u7EDF\u7EA7\u64CD\u4F5C\u3002`
            );
            this.logger.error({
              message: `eval \u88AB\u5B89\u5168\u62E6\u622A: ${guard.reasons?.join(", ")}`,
              code: "EVAL_BLOCKED",
              reason: "dangerous-script",
              raw: script.slice(0, 300),
              explanation: "\u68C0\u6D4B\u5230\u9AD8\u5371\u6CE8\u5165\u811A\u672C\uFF0C\u4E3A\u9632\u63D0\u6743/\u6E17\u900F\u5DF2\u62D2\u7EDD\u6267\u884C\u3002",
              suggestion: "\u79FB\u9664\u6587\u4EF6\u7CFB\u7EDF/\u5B50\u8FDB\u7A0B/\u7CFB\u7EDF\u7EA7\u8BBF\u95EE\u4EE3\u7801\uFF0C\u4EC5\u4FDD\u7559\u9875\u9762\u5185\u7684 DOM/JS \u8BCA\u65AD\u3002"
            });
            break;
          }
          const evalResult = await b.eval(script);
          const sanitizedResult = redactDeep(evalResult);
          result = okResult(`\u6267\u884C\u7ED3\u679C: ${JSON.stringify(sanitizedResult)?.slice(0, 2e3)}`, { result: sanitizedResult });
          this.logger.log({ category: "action", message: "eval \u6267\u884C" });
          break;
        }
        case "screenshot": {
          const b = await this.ensureBrowser();
          const shot = await b.act({ type: "screenshot", fullPage: !!args.fullPage });
          const base64 = shot.data?.base64;
          const dataUri = `data:image/png;base64,${base64}`;
          result = okResult(shot.summary, { image: dataUri });
          this.logger.screenshot({
            dataUri,
            fullPage: !!args.fullPage,
            caption: args.caption ? String(args.caption) : shot.summary
          });
          break;
        }
        case "session_log": {
          const events = this.logger.toArray();
          const format = String(args.format ?? "markdown");
          if (format === "json") {
            result = okResult(`\u5171 ${events.length} \u6761\u4E8B\u4EF6`, { events: redactDeep(events) });
          } else {
            const md = this.logger.exportMarkdown({ title: args.title ? String(args.title) : void 0 });
            result = okResult(md, { eventCount: events.length });
          }
          break;
        }
        case "close": {
          if (this.browser) {
            await this.browser.stop();
            this.browser = void 0;
          }
          result = okResult("\u6D4F\u89C8\u5668\u5DF2\u5173\u95ED");
          this.logger.system("\u6D4F\u89C8\u5668\u5DF2\u5173\u95ED");
          break;
        }
        case "stealth_status": {
          const stealthOpts = this.opts.stealth;
          const enabled = stealthOpts?.enabled ?? false;
          const level = stealthOpts?.level ?? "basic";
          const ua = stealthOpts?.userAgent ?? "default";
          const lines = [
            `# \u9632\u68C0\u6D4B\uFF08Stealth\uFF09\u72B6\u6001`,
            `- **\u542F\u7528**: ${enabled ? "\u2705 \u662F" : "\u274C \u5426"}`,
            `- **\u7EA7\u522B**: ${level}`,
            `- **User-Agent**: ${ua}`,
            ``,
            enabled ? "> Stealth \u5DF2\u542F\u7528\uFF1A\u53CD\u6307\u7EB9\u6CE8\u5165\u3001\u81EA\u52A8\u5316\u63A7\u5236\u9690\u85CF\u3001\u4EBA\u7C7B\u884C\u4E3A\u6A21\u62DF\u5747\u751F\u6548\u3002" : "> Stealth \u672A\u542F\u7528\u3002\u82E5\u91C7\u96C6\u516C\u5F00\u6570\u636E\u65F6\u88AB\u9650\u901F/\u5C01\u7981\uFF0C\u53EF\u901A\u8FC7 `stealth.enabled=true` \u5728\u521D\u59CB\u5316\u65F6\u5F00\u542F\u3002"
          ];
          result = okResult(lines.join("\n"), { enabled, level, ua });
          this.logger.log({ category: "system", message: `\u67E5\u8BE2 stealth \u72B6\u6001: ${enabled ? "enabled" : "disabled"}` });
          break;
        }
        default:
          result = errResult(`\u672A\u77E5\u5DE5\u5177: ${name2}\u3002\u53EF\u7528\u5DE5\u5177: ${TOOLS.map((t) => t.name).join(", ")}`);
      }
      result = this.attachEvents(result, name2);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({
        message: `\u5DE5\u5177 ${name2} \u6267\u884C\u5F02\u5E38: ${msg}`,
        code: "TOOL_EXCEPTION",
        reason: "uncaught-exception",
        raw: msg,
        explanation: `\u5DE5\u5177 ${name2} \u5728\u6267\u884C\u65F6\u629B\u51FA\u672A\u6355\u83B7\u5F02\u5E38\u3002`,
        suggestion: "\u68C0\u67E5\u53C2\u6570\u662F\u5426\u5408\u6CD5\u3001\u6D4F\u89C8\u5668\u662F\u5426\u53EF\u7528\u3001\u7F51\u7EDC\u662F\u5426\u8FDE\u901A\uFF1B\u53EF\u5148 observe \u786E\u8BA4\u9875\u9762\u72B6\u6001\u3002",
        detail: err instanceof Error && err.stack ? err.stack.slice(0, 500) : void 0
      });
      const result = this.attachEvents(errResult(`\u5DE5\u5177\u6267\u884C\u5931\u8D25: ${msg}`), name2);
      return result;
    }
  }
  /** 把最近事件附加到 ToolResult.structured，供外部 AI 消费事件流 */
  attachEvents(result, _name) {
    if (!result.structured) result.structured = {};
    const events = this.logger.toArray().slice(-30);
    result.structured.events = events;
    result.structured.sessionId = this.logger.sessionId;
    return result;
  }
  /** 隐藏敏感参数（避免把 value/script/url 中的敏感信息全文塞入日志） */
  safeArgs(args) {
    const safe = {};
    for (const [k, v] of Object.entries(args)) {
      if (k === "value" || k === "script") safe[k] = typeof v === "string" ? `<${v.length} chars>` : v;
      else if (k === "url" && typeof v === "string") safe[k] = redactUrl(v);
      else if (k === "expected" && typeof v === "string") safe[k] = v.length > 60 ? `${v.slice(0, 60)}...` : v;
      else safe[k] = v;
    }
    return safe;
  }
  /** 动作类型 -> 稳定错误码 */
  mapErrorCode(type) {
    return `ACTION_FAILED_${type.toUpperCase()}`;
  }
  /** 从摘要/诊断推断根因分类 */
  mapErrorReason(summary, diagnostics) {
    const s = summary.toLowerCase();
    if (s.includes("timeout") || s.includes("\u8D85\u65F6")) return "timeout";
    if (s.includes("404") || s.includes("500") || s.includes("network") || s.includes("\u7F51\u7EDC")) return "network-failure";
    if (s.includes("not found") || s.includes("\u627E\u4E0D\u5230") || s.includes("\u65E0\u6CD5\u5B9A\u4F4D") || s.includes("\u672A\u627E\u5230") || s.includes("locator")) return "locator-not-found";
    if (diagnostics?.some((d) => d.kind === "js-exception")) return "js-exception";
    if (diagnostics?.some((d) => d.kind === "dom")) return "dom-unrendered";
    return "action-failed";
  }
  /** 面向 AI 的根因解释 */
  buildExplanation(summary, diagnostics) {
    const reason = this.mapErrorReason(summary, diagnostics);
    const extras = (diagnostics ?? []).slice(0, 3).map((d) => d.message).join("; ");
    switch (reason) {
      case "locator-not-found":
        return `\u9875\u9762\u4E2D\u672A\u627E\u5230\u76EE\u6807\u5143\u7D20\u3002${extras ? `\u8BCA\u65AD\u63D0\u793A: ${extras}` : "\u53EF\u80FD\u662F\u5143\u7D20\u672A\u6E32\u67D3\u3001\u9009\u62E9\u5668\u53D8\u5316\u3001\u6216\u9875\u9762\u8FD8\u5728\u52A0\u8F7D\u3002"}`;
      case "timeout":
        return `\u64CD\u4F5C\u8D85\u65F6\uFF0C\u5143\u7D20\u6216\u5BFC\u822A\u5728\u9650\u5B9A\u65F6\u95F4\u5185\u672A\u5C31\u7EEA\u3002${extras ? `\u8BCA\u65AD\u63D0\u793A: ${extras}` : ""}`;
      case "network-failure":
        return `\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\u6216\u76EE\u6807\u4E0D\u53EF\u8FBE\u3002${extras ? `\u8BCA\u65AD\u63D0\u793A: ${extras}` : ""}`;
      case "js-exception":
        return `\u9875\u9762\u629B\u51FA\u4E86 JS \u672A\u6355\u83B7\u5F02\u5E38\uFF0C\u53EF\u80FD\u963B\u65AD\u4EA4\u4E92\u3002${extras ? `\u8BCA\u65AD\u63D0\u793A: ${extras}` : ""}`;
      case "dom-unrendered":
        return `\u9875\u9762 DOM \u672A\u6B63\u5E38\u6E32\u67D3\uFF08\u767D\u5C4F/\u672A\u6302\u8F7D\uFF09\uFF0C\u521D\u59CB\u5316 JS \u53EF\u80FD\u51FA\u9519\u3002`;
      default:
        return `\u52A8\u4F5C\u6267\u884C\u5931\u8D25: ${summary.slice(0, 200)}`;
    }
  }
  /** 可行动的修复建议 */
  buildSuggestion(summary) {
    const reason = this.mapErrorReason(summary);
    switch (reason) {
      case "locator-not-found":
        return "\u5148 observe \u67E5\u770B\u5F53\u524D DOM\uFF0C\u5207\u6362\u5B9A\u4F4D\u7B56\u7565(ref\u2192selector\u2192text\u2192semantic)\uFF0C\u6216 wait \u5143\u7D20\u5C31\u7EEA\u540E\u91CD\u8BD5\u3002";
      case "timeout":
        return "\u68C0\u67E5\u9875\u9762\u52A0\u8F7D/\u7F51\u7EDC\uFF0C\u53EF\u5EF6\u957F wait \u6216\u6539\u7528 waitUntil \u7B56\u7565\uFF1B\u82E5\u5143\u7D20\u662F\u5F02\u6B65\u6E32\u67D3\uFF0C\u5148\u7B49\u5176\u51FA\u73B0\u3002";
      case "network-failure":
        return "\u6838\u5BF9 URL/\u63A5\u53E3\u8DEF\u5F84\u3001CORS \u4E0E\u540E\u7AEF\u72B6\u6001\uFF1B\u5FC5\u8981\u65F6\u7528 diagnose \u67E5\u770B\u7F51\u7EDC\u5931\u8D25\u8BE6\u60C5\u3002";
      case "js-exception":
        return "\u7528 diagnose \u5C55\u5F00\u5F02\u5E38\u5806\u6808\uFF0C\u5B9A\u4F4D throw/\u672A\u5B9A\u4E49/\u5F02\u6B65\u672A catch\uFF0C\u4FEE\u590D\u540E\u91CD\u8BD5\u3002";
      case "dom-unrendered":
        return "\u68C0\u67E5\u521D\u59CB\u5316 JS \u662F\u5426\u629B\u9519\u5BFC\u81F4\u6574\u6811\u672A\u6E32\u67D3\uFF1B\u7528 diagnose \u7684 dom \u7EF4\u5EA6\u5B9A\u4F4D\u767D\u5C4F\u6839\u56E0\u3002";
      default:
        return "\u7528 diagnose \u91C7\u96C6\u5B8C\u6574\u8BCA\u65AD\uFF0C\u7ED3\u5408\u65E5\u5FD7\u4E8B\u4EF6\u5B9A\u4F4D\u6839\u56E0\u540E\u4FEE\u6B63\u52A8\u4F5C\u3002";
    }
  }
  /** 把扁平参数规整为统一动作 */
  normalizeAction(args) {
    const type = String(args.type);
    const base = { type, description: args.description };
    const loc = {};
    if (args.ref) loc.ref = args.ref;
    if (args.selector) loc.selector = args.selector;
    if (args.text) loc.text = args.text;
    if (args.semantic) loc.semantic = args.semantic;
    const rest = {};
    for (const k of ["url", "value", "key", "ms", "script", "mode", "expected", "fullPage", "deltaY", "delay", "waitUntil", "waitForNavigation"]) {
      if (args[k] !== void 0) rest[k] = args[k];
    }
    return { ...base, ...loc, ...rest };
  }
  /** 关闭（供传输层退出时调用） */
  async shutdown() {
    if (this.browser) await this.browser.stop();
  }
};

// packages/mcp-server/src/solutions.ts
function fingerprintError(text) {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  if (/cors|access-control|跨域/.test(t)) return "network:cors";
  if (/ttfb|慢请求/.test(t)) return "performance:ttfb";
  if (/失败请求|请求失败|request failed|status\s*[:\s]*(?:404|500)/.test(t)) return "network:http-error";
  if (/\b(?:404|500)\b/.test(t) && !/\d{4,}/.test(t)) return "network:http-error";
  if (/uncaught|未捕获|typeerror|referenceerror|js 异常/.test(t)) return "console:js-exception";
  if (/未找到|无法定位|定位失败|定位.*失败|element not found|no element|not found|找不到/.test(t)) return "dom:locator-failed";
  if (/401|403|登录|鉴权|未授权|redirect|重定向/.test(t)) return "auth:redirect";
  if (/hydration|水合|did not match/.test(t)) return "dom:hydration-mismatch";
  if (/白屏|空白|blank|未渲染/.test(t)) return "dom:blank-page";
  return "generic:action-failed";
}
var RepeatErrorRegistry = class {
  counts = /* @__PURE__ */ new Map();
  /** 自定义触发阈值（默认 2） */
  threshold;
  constructor(threshold = 2) {
    this.threshold = threshold;
  }
  /** 记录一次错误，返回是否达到触发阈值 */
  record(text) {
    const fp = fingerprintError(text);
    const occurrences = (this.counts.get(fp) ?? 0) + 1;
    this.counts.set(fp, occurrences);
    return { fingerprint: fp, occurrences, triggered: occurrences >= this.threshold };
  }
  /** 查询某指纹当前次数（不改变计数） */
  peek(text) {
    const fp = fingerprintError(text);
    return { fingerprint: fp, occurrences: this.counts.get(fp) ?? 0 };
  }
  /** 重置（新一轮调试开始时可调用） */
  reset() {
    this.counts.clear();
  }
};
var defaultRegistry = new RepeatErrorRegistry();

// src/plugin.ts
var name = "openliulan-browser";
var DEFAULT_PREFIX = "browser";
function toRecord(args) {
  return typeof args === "object" && args !== null ? args : {};
}
function resultText(content) {
  if (!content || content.length === 0) return "(\u65E0\u8F93\u51FA)";
  return content.map((block) => block.text ?? "").join("\n");
}
function apply(ctx, config = {}) {
  const prefix = typeof config.prefix === "string" && config.prefix ? config.prefix : DEFAULT_PREFIX;
  const mcp = new ForgeMcp({
    headless: config.headless === void 0 ? true : Boolean(config.headless),
    connectUrl: typeof config.connectUrl === "string" ? config.connectUrl : void 0,
    stealth: config.stealth ?? void 0
  });
  const tools = ctx.tools;
  for (const tool of mcp.tools) {
    const parameters = tool.inputSchema.properties ?? {};
    const publicName = `${prefix}_${tool.name}`;
    ctx.effect(
      () => tools.register({
        name: publicName,
        description: tool.description,
        parameters,
        output: {
          schema: {
            type: "object",
            properties: { content: { type: "array", items: {} } },
            required: ["content"],
            additionalProperties: false
          },
          render(_args, value) {
            const text = resultText((value ?? {}).content ?? []);
            return [{ type: "text", text }];
          }
        },
        execute: async (args) => {
          const result = await mcp.callTool(tool.name, toRecord(args));
          const text = resultText(result.content);
          if (!result.ok) throw new Error(text);
          return { isError: false, value: { content: text }, content: [{ type: "text", text }] };
        }
      }),
      "openliulan.tool"
    );
  }
}
export {
  apply,
  name
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vcGFja2FnZXMvZGlhZ25vc2lzL3NyYy9hbmFseXplci50cyIsICIuLi9wYWNrYWdlcy9kaWFnbm9zaXMvc3JjL3R5cGVzLnRzIiwgIi4uL3BhY2thZ2VzL2RpYWdub3Npcy9zcmMvaW5kZXgudHMiLCAiLi4vcGFja2FnZXMvbWNwLXNlcnZlci9zcmMvdG9vbHMudHMiLCAiLi4vbm9kZV9tb2R1bGVzL3pvZC92My9leHRlcm5hbC5qcyIsICIuLi9ub2RlX21vZHVsZXMvem9kL3YzL2hlbHBlcnMvdXRpbC5qcyIsICIuLi9ub2RlX21vZHVsZXMvem9kL3YzL1pvZEVycm9yLmpzIiwgIi4uL25vZGVfbW9kdWxlcy96b2QvdjMvbG9jYWxlcy9lbi5qcyIsICIuLi9ub2RlX21vZHVsZXMvem9kL3YzL2Vycm9ycy5qcyIsICIuLi9ub2RlX21vZHVsZXMvem9kL3YzL2hlbHBlcnMvcGFyc2VVdGlsLmpzIiwgIi4uL25vZGVfbW9kdWxlcy96b2QvdjMvaGVscGVycy9lcnJvclV0aWwuanMiLCAiLi4vbm9kZV9tb2R1bGVzL3pvZC92My90eXBlcy5qcyIsICIuLi9wYWNrYWdlcy9jb3JlL3NyYy9hY3Rpb25zLnRzIiwgIi4uL3BhY2thZ2VzL2NvcmUvc3JjL3Nlc3Npb24udHMiLCAiLi4vcGFja2FnZXMvY29yZS9zcmMvZm9yZ2UudHMiLCAiLi4vcGFja2FnZXMvZW5naW5lcy9zcmMvbG9jYXRvci50cyIsICIuLi9wYWNrYWdlcy9lbmdpbmVzL3NyYy9zbmFwc2hvdC50cyIsICIuLi9wYWNrYWdlcy9lbmdpbmVzL3NyYy9kaWFnbm9zdGljcy50cyIsICIuLi9wYWNrYWdlcy9lbmdpbmVzL3NyYy9wbGF5d3JpZ2h0LWVuZ2luZS50cyIsICIuLi9wYWNrYWdlcy9haS1sYXllci9zcmMvc2VtYW50aWMtbG9jYXRvci50cyIsICIuLi9wYWNrYWdlcy9zdGVhbHRoL3NyYy9zdGVhbHRoLnRzIiwgIi4uL3BhY2thZ2VzL3Rva2VuL3NyYy9pbmRleC50cyIsICIuLi9wYWNrYWdlcy9tY3Atc2VydmVyL3NyYy9zZWN1cml0eS50cyIsICIuLi9wYWNrYWdlcy9tY3Atc2VydmVyL3NyYy9sb2dnZXIudHMiLCAiLi4vcGFja2FnZXMvbWNwLXNlcnZlci9zcmMvZm9yZ2UtbWNwLnRzIiwgIi4uL3BhY2thZ2VzL21jcC1zZXJ2ZXIvc3JjL3NvbHV0aW9ucy50cyIsICIuLi9zcmMvcGx1Z2luLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIFx1OEJDQVx1NjVBRFx1NTIwNlx1Njc5MFx1NTY2OFx1RkYxQVx1NjI4QVx1NTM5Rlx1NTlDQlx1OEJDQVx1NjVBRFx1NjU3MFx1NjM2RVx1NTJBMFx1NURFNVx1NjIxMFx1NEY5QiBBSSBcdTUxQjNcdTdCNTZcdTc2ODRcdTdFRDNcdThCQkFcdTMwMDJcbiAqIFx1NTAxRlx1OTI3NCBDaHJvbWUgRGV2VG9vbHMgTUNQXHUzMDBDXHU1MTQ4XHU3RUQ5XHU3RUQzXHU4QkJBXHUzMDAxXHU1MThEXHU3RUQ5XHU3RUM2XHU4MjgyXHUzMDBEXHU3Njg0XHU2MDFEXHU4REVGXHVGRjBDXHU4MjgyXHU3NzAxIFRva2VuXHUzMDAyXG4gKi9cbmltcG9ydCB0eXBlIHsgRGlhZ25vc3RpY1JlZiB9IGZyb20gXCJAb3BlbmxpdWxhbi9jb3JlXCI7XG5pbXBvcnQgdHlwZSB7IERpYWdub3Npc1JlcG9ydCwgRGlhZ25vc2lzU3VtbWFyeSwgTmV0d29ya1JlY29yZCwgUGVyZm9ybWFuY2VNZXRyaWNzIH0gZnJvbSBcIi4vdHlwZXMuanNcIjtcblxuLyoqXG4gKiBcdTdGNTFcdTdFRENcdTU5MzFcdThEMjVcdTUyMDZcdTY3OTBcdUZGMUFcdTVDMDZcdTdGNTFcdTdFRENcdThCQjBcdTVGNTVcdThGNkNcdTUzMTZcdTRFM0FcdThCQ0FcdTY1QURcdTVGMTVcdTc1MjhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVOZXR3b3JrKHJlY29yZHM6IE5ldHdvcmtSZWNvcmRbXSk6IHsgcmVmczogRGlhZ25vc3RpY1JlZltdOyBzdWdnZXN0aW9uczogc3RyaW5nW10gfSB7XG4gIGNvbnN0IHJlZnM6IERpYWdub3N0aWNSZWZbXSA9IFtdO1xuICBjb25zdCBzdWdnZXN0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZmFpbGVkID0gcmVjb3Jkcy5maWx0ZXIoKHIpID0+IHIuc3RhdHVzID49IDQwMCB8fCByLmVycm9yKTtcbiAgY29uc3Qgc2xvdyA9IHJlY29yZHMuZmlsdGVyKChyKSA9PiByLmR1cmF0aW9uTXMgPiAzMDAwKTtcblxuICBmb3IgKGNvbnN0IHIgb2YgZmFpbGVkKSB7XG4gICAgcmVmcy5wdXNoKHtcbiAgICAgIGtpbmQ6IFwibmV0d29ya1wiLFxuICAgICAgc2V2ZXJpdHk6IHIuc3RhdHVzID49IDUwMCA/IFwiZXJyb3JcIiA6IFwid2FybmluZ1wiLFxuICAgICAgbWVzc2FnZTogYFx1OEJGN1x1NkM0Mlx1NTkzMVx1OEQyNSAke3IubWV0aG9kfSAke3IudXJsfSAoJHtyLnN0YXR1c30ke3Iuc3RhdHVzVGV4dCA/IFwiIFwiICsgci5zdGF0dXNUZXh0IDogXCJcIn0pJHtyLmVycm9yID8gXCIgXHUyMDE0IFwiICsgci5lcnJvciA6IFwiXCJ9YCxcbiAgICAgIGRldGFpbDogeyBkdXJhdGlvbk1zOiByLmR1cmF0aW9uTXMsIHJlcXVlc3RJZDogci5yZXF1ZXN0SWQgfSxcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgfVxuICBmb3IgKGNvbnN0IHIgb2Ygc2xvdykge1xuICAgIHJlZnMucHVzaCh7XG4gICAgICBraW5kOiBcIm5ldHdvcmtcIixcbiAgICAgIHNldmVyaXR5OiBcIndhcm5pbmdcIixcbiAgICAgIG1lc3NhZ2U6IGBcdTYxNjJcdThCRjdcdTZDNDIgJHtyLmR1cmF0aW9uTXN9bXMgJHtyLm1ldGhvZH0gJHtyLnVybH1gLFxuICAgICAgZGV0YWlsOiB7IHN0YXR1czogci5zdGF0dXMgfSxcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChmYWlsZWQubGVuZ3RoKSBzdWdnZXN0aW9ucy5wdXNoKGBcdTdGNTFcdTdFRENcdTVCNThcdTU3MjggJHtmYWlsZWQubGVuZ3RofSBcdTRFMkFcdTU5MzFcdThEMjVcdThCRjdcdTZDNDJcdUZGMENcdTUzRUZcdTgwRkRcdTY2MkZcdThENDRcdTZFOTAgNDA0LzUwMCBcdTYyMTYgQ09SUy9cdThERThcdTU3REZcdTk2M0JcdTY1QURgKTtcbiAgaWYgKHNsb3cubGVuZ3RoKSBzdWdnZXN0aW9ucy5wdXNoKGBcdTVCNThcdTU3MjggJHtzbG93Lmxlbmd0aH0gXHU0RTJBXHU2MTYyXHU4QkY3XHU2QzQyKD4zcylcdUZGMENcdTgwMDNcdTg2NTFcdTY4QzBcdTY3RTVcdTU0MEVcdTdBRUZcdTYzQTVcdTUzRTNcdTYyMTZcdThENDRcdTZFOTBcdTUyQTBcdThGN0RgKTtcbiAgcmV0dXJuIHsgcmVmcywgc3VnZ2VzdGlvbnMgfTtcbn1cblxuLyoqXG4gKiBcdTYwMjdcdTgwRkRcdTUyMDZcdTY3OTBcdUZGMUFcdTVDMDZcdTYzMDdcdTY4MDdcdThGNkNcdTUzMTZcdTRFM0FcdThCQ0FcdTY1QURcdTVGMTVcdTc1MjhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVQZXJmb3JtYW5jZShtZXRyaWNzOiBQZXJmb3JtYW5jZU1ldHJpY3MpOiB7IHJlZnM6IERpYWdub3N0aWNSZWZbXTsgc3VnZ2VzdGlvbnM6IHN0cmluZ1tdIH0ge1xuICBjb25zdCByZWZzOiBEaWFnbm9zdGljUmVmW10gPSBbXTtcbiAgY29uc3Qgc3VnZ2VzdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKG1ldHJpY3MudHRmYiA+IDEwMDApIHtcbiAgICByZWZzLnB1c2goe1xuICAgICAga2luZDogXCJwZXJmb3JtYW5jZVwiLFxuICAgICAgc2V2ZXJpdHk6IFwid2FybmluZ1wiLFxuICAgICAgbWVzc2FnZTogYFRURkIgXHU1MDRGXHU5QUQ4OiAke21ldHJpY3MudHRmYn1tc1x1RkYwOFx1OTk5Nlx1NUI1N1x1ODI4Mlx1NTRDRFx1NUU5NFx1NjE2Mlx1RkYwQ1x1NTNFRlx1ODBGRFx1NjcwRFx1NTJBMVx1N0FFRlx1NjE2Mlx1NjIxNlx1N0Y1MVx1N0VEQ1x1NURFRVx1RkYwOWAsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgfSk7XG4gICAgc3VnZ2VzdGlvbnMucHVzaChcIlRURkIgPiAxc1x1RkYwQ1x1NEYxOFx1NTE0OFx1NjM5Mlx1NjdFNVx1NjcwRFx1NTJBMVx1N0FFRlx1NTRDRFx1NUU5NFx1NEUwRSBDRE5cIik7XG4gIH1cbiAgaWYgKG1ldHJpY3MubGNwICYmIG1ldHJpY3MubGNwID4gMjUwMCkge1xuICAgIHJlZnMucHVzaCh7XG4gICAgICBraW5kOiBcInBlcmZvcm1hbmNlXCIsXG4gICAgICBzZXZlcml0eTogXCJ3YXJuaW5nXCIsXG4gICAgICBtZXNzYWdlOiBgTENQIFx1NTA0Rlx1OUFEODogJHttZXRyaWNzLmxjcH1tc1x1RkYwOFx1NjcwMFx1NTkyN1x1NTE4NVx1NUJCOVx1N0VEOFx1NTIzNlx1NjE2Mlx1RkYwQ1x1NUY3MVx1NTRDRFx1OTk5Nlx1NUM0Rlx1RkYwOWAsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgfSk7XG4gICAgc3VnZ2VzdGlvbnMucHVzaChcIkxDUCA+IDIuNXNcdUZGMENcdTUxNzNcdTZDRThcdTk5OTZcdTVDNEZcdTU2RkVcdTcyNDcvXHU1OTI3XHU4RDQ0XHU2RTkwXHU1MkEwXHU4RjdEXCIpO1xuICB9XG4gIGlmIChtZXRyaWNzLmxvbmdUYXNrcyA+IDMpIHtcbiAgICByZWZzLnB1c2goe1xuICAgICAga2luZDogXCJwZXJmb3JtYW5jZVwiLFxuICAgICAgc2V2ZXJpdHk6IFwid2FybmluZ1wiLFxuICAgICAgbWVzc2FnZTogYFx1NEUzQlx1N0VCRlx1N0EwQlx1OTU3Rlx1NEVGQlx1NTJBMSAke21ldHJpY3MubG9uZ1Rhc2tzfSBcdTZCMjFcdUZGMDhKUyBcdTUzRUZcdTgwRkRcdTk2M0JcdTU4NUVcdTZFMzJcdTY3RDNcdUZGMDlgLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgIH0pO1xuICAgIHN1Z2dlc3Rpb25zLnB1c2goXCJcdTVCNThcdTU3MjhcdTk1N0ZcdTRFRkJcdTUyQTFcdTk2M0JcdTU4NUVcdTRFM0JcdTdFQkZcdTdBMEJcdUZGMENcdTY4QzBcdTY3RTVcdTU0MENcdTZCNjVcdTgxMUFcdTY3MkMvXHU1QkM2XHU5NkM2XHU4QkExXHU3Qjk3XCIpO1xuICB9XG4gIGlmIChtZXRyaWNzLnJlc291cmNlcy50b3RhbEJ5dGVzID4gNSAqIDEwMjQgKiAxMDI0KSB7XG4gICAgcmVmcy5wdXNoKHtcbiAgICAgIGtpbmQ6IFwicGVyZm9ybWFuY2VcIixcbiAgICAgIHNldmVyaXR5OiBcImluZm9cIixcbiAgICAgIG1lc3NhZ2U6IGBcdTk4NzVcdTk3NjJcdThENDRcdTZFOTBcdTYwM0JcdTkxQ0ZcdThGODNcdTU5Mjc6ICR7KG1ldHJpY3MucmVzb3VyY2VzLnRvdGFsQnl0ZXMgLyAxMDI0IC8gMTAyNCkudG9GaXhlZCgxKX1NQmAsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHsgcmVmcywgc3VnZ2VzdGlvbnMgfTtcbn1cblxuLyoqXG4gKiBcdTZDNDdcdTYwM0JcdThCQ0FcdTY1QURcdTYyQTVcdTU0NEFcdUZGMENcdTc1MUZcdTYyMTBcdTUwNjVcdTVFQjdcdTVFQTZcdTRFMEVcdTVFRkFcdThCQUVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1bW1hcml6ZShyZXBvcnQ6IERpYWdub3Npc1JlcG9ydCk6IERpYWdub3Npc1N1bW1hcnkge1xuICBjb25zdCBpc3N1ZXM6IERpYWdub3Npc1N1bW1hcnlbXCJpc3N1ZXNcIl0gPSBbXTtcbiAgY29uc3Qgc3VnZ2VzdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gXHU2M0E3XHU1MjM2XHU1M0YwXHU5NTE5XHU4QkVGXG4gIGNvbnN0IGNvbnNvbGVFcnJvcnMgPSByZXBvcnQuY29uc29sZS5maWx0ZXIoKGMpID0+IGMuc2V2ZXJpdHkgPT09IFwiZXJyb3JcIik7XG4gIGZvciAoY29uc3QgZSBvZiBjb25zb2xlRXJyb3JzKSB7XG4gICAgaXNzdWVzLnB1c2goeyBjYXRlZ29yeTogXCJjb25zb2xlXCIsIHNldmVyaXR5OiBcImVycm9yXCIsIG1lc3NhZ2U6IGUubWVzc2FnZSB9KTtcbiAgfVxuICBpZiAoY29uc29sZUVycm9ycy5sZW5ndGgpIHN1Z2dlc3Rpb25zLnB1c2goYFx1NjNBN1x1NTIzNlx1NTNGMFx1NjcwOSAke2NvbnNvbGVFcnJvcnMubGVuZ3RofSBcdTY3NjFcdTk1MTlcdThCRUZcdUZGMENcdTUzRUZcdTgwRkRcdTY2MkYgSlMgXHU1RjAyXHU1RTM4XHU2MjE2XHU4RDQ0XHU2RTkwXHU1MkEwXHU4RjdEXHU1OTMxXHU4RDI1YCk7XG5cbiAgLy8gSlMgXHU1RjAyXHU1RTM4XG4gIGZvciAoY29uc3QgZSBvZiByZXBvcnQuanNFeGNlcHRpb25zKSB7XG4gICAgaXNzdWVzLnB1c2goeyBjYXRlZ29yeTogXCJqcy1leGNlcHRpb25cIiwgc2V2ZXJpdHk6IFwiZXJyb3JcIiwgbWVzc2FnZTogZS5tZXNzYWdlIH0pO1xuICB9XG4gIGlmIChyZXBvcnQuanNFeGNlcHRpb25zLmxlbmd0aCkgc3VnZ2VzdGlvbnMucHVzaChcIlx1OTg3NVx1OTc2Mlx1NjI5Qlx1NTFGQVx1NEU4NiBKUyBcdTY3MkFcdTYzNTVcdTgzQjdcdTVGMDJcdTVFMzhcdUZGMENcdTY4QzBcdTY3RTVcdTVCRjlcdTVFOTRcdTU4MDZcdTY4MDhcIik7XG5cbiAgLy8gXHU3RjUxXHU3RURDXG4gIGNvbnN0IG5ldEZhaWxlZCA9IHJlcG9ydC5uZXR3b3JrLmZpbHRlcigobikgPT4gbi5zZXZlcml0eSA9PT0gXCJlcnJvclwiKTtcbiAgZm9yIChjb25zdCBuIG9mIG5ldEZhaWxlZCkgaXNzdWVzLnB1c2goeyBjYXRlZ29yeTogXCJuZXR3b3JrXCIsIHNldmVyaXR5OiBcImVycm9yXCIsIG1lc3NhZ2U6IG4ubWVzc2FnZSB9KTtcbiAgY29uc3QgbmV0V2FybiA9IHJlcG9ydC5uZXR3b3JrLmZpbHRlcigobikgPT4gbi5zZXZlcml0eSA9PT0gXCJ3YXJuaW5nXCIpO1xuICBmb3IgKGNvbnN0IG4gb2YgbmV0V2FybikgaXNzdWVzLnB1c2goeyBjYXRlZ29yeTogXCJuZXR3b3JrXCIsIHNldmVyaXR5OiBcIndhcm5pbmdcIiwgbWVzc2FnZTogbi5tZXNzYWdlIH0pO1xuXG4gIC8vIERPTSBcdTY4QzBcdTY3RTVcdUZGMDhcdTc2N0RcdTVDNEYvXHU2NzJBXHU2RTMyXHU2N0QzL1x1NjVFMFx1NEVBNFx1NEU5Mlx1N0I0OVx1RkYwQ1x1NEVDRSBjb25zb2xlL25ldHdvcmsgXHU3NzBCXHU0RTBEXHU1MjMwXHU3Njg0XHU2RTMyXHU2N0QzXHU3RUE3XHU5NUVFXHU5ODk4XHVGRjA5XG4gIGZvciAoY29uc3QgZCBvZiByZXBvcnQuZG9tKSB7XG4gICAgaXNzdWVzLnB1c2goeyBjYXRlZ29yeTogXCJkb21cIiwgc2V2ZXJpdHk6IGQuc2V2ZXJpdHkgPT09IFwiZXJyb3JcIiA/IFwiZXJyb3JcIiA6IFwid2FybmluZ1wiLCBtZXNzYWdlOiBkLm1lc3NhZ2UgfSk7XG4gIH1cbiAgY29uc3QgZG9tQmxhbmsgPSByZXBvcnQuZG9tLmZpbHRlcigoZCkgPT4gZC5zZXZlcml0eSA9PT0gXCJlcnJvclwiKTtcbiAgaWYgKGRvbUJsYW5rLmxlbmd0aCkgc3VnZ2VzdGlvbnMucHVzaChcIlx1OTg3NVx1OTc2Mlx1NzU5MVx1NEYzQ1x1N0E3QVx1NzY3RC9cdTY3MkFcdTZFMzJcdTY3RDNcdUZGMENcdTY4QzBcdTY3RTVcdTYzMDJcdThGN0RcdTgyODJcdTcwQjlcdTRFMEVcdTUyMURcdTU5Q0JcdTUzMTZcdTgxMUFcdTY3MkNcdUZGMDhcdTUzRUZcdTgwRkQgSlMgXHU2MkE1XHU5NTE5XHU5NjNCXHU2NUFEXHU2NTc0XHU2ODExXHU2RTMyXHU2N0QzXHVGRjA5XCIpO1xuXG4gIC8vIFx1NjAyN1x1ODBGRFxuICBmb3IgKGNvbnN0IHAgb2YgcmVwb3J0LnBlcmZvcm1hbmNlKSB7XG4gICAgaWYgKHAuc2V2ZXJpdHkgPT09IFwid2FybmluZ1wiKSBpc3N1ZXMucHVzaCh7IGNhdGVnb3J5OiBcInBlcmZvcm1hbmNlXCIsIHNldmVyaXR5OiBcIndhcm5pbmdcIiwgbWVzc2FnZTogcC5tZXNzYWdlIH0pO1xuICB9XG5cbiAgLy8gXHU1M0JCXHU5MUNEXHU1RUZBXHU4QkFFXG4gIGNvbnN0IHVuaXF1ZSA9IFsuLi5uZXcgU2V0KHN1Z2dlc3Rpb25zKV07XG4gIHJldHVybiB7XG4gICAgaGVhbHRoeTogaXNzdWVzLmZpbHRlcigoaSkgPT4gaS5zZXZlcml0eSA9PT0gXCJlcnJvclwiKS5sZW5ndGggPT09IDAsXG4gICAgaXNzdWVzOiBpc3N1ZXMuc2xpY2UoMCwgMTUpLFxuICAgIHN1Z2dlc3Rpb25zOiB1bmlxdWUuc2xpY2UoMCwgOCksXG4gIH07XG59XG4iLCAiLyoqXG4gKiBcdThDMDNcdThCRDVcdThCQ0FcdTY1QURcdTRFMkRcdTVGQzMgXHUyMDE0XHUyMDE0IDUgXHU2NjFGXHU4MEZEXHU1MjlCXG4gKlxuICogXHU1MDFGXHU5Mjc0IENocm9tZSBEZXZUb29scyBNQ1AgXHU3Njg0XHU4QkNBXHU2NUFEXHU4MEZEXHU1MjlCXHVGRjBDXHU0RTNBIEFJIFx1NjNEMFx1NEY5Qlx1NTE2OFx1OTRGRVx1OERFRlx1OTg3NVx1OTc2Mlx1OEJDQVx1NjVBRFx1RkYxQVxuICogMS4gRE9NIFx1NjhDMFx1NjdFNVx1NEUwRVx1NUI5QVx1NEY0RFxuICogMi4gXHU2M0E3XHU1MjM2XHU1M0YwXHU2RDg4XHU2MDZGL1x1OTUxOVx1OEJFRlxuICogMy4gXHU3RjUxXHU3RURDXHU4QkY3XHU2QzQyXHU0RTBFXHU1OTMxXHU4RDI1XHU1MjA2XHU2NzkwXG4gKiA0LiBcdTYwMjdcdTgwRkRcdTYzMDdcdTY4MDdcbiAqIDUuIEpTIFx1NUYwMlx1NUUzOFx1NEUwRVx1NTgwNlx1NjgwOFxuICovXG5pbXBvcnQgdHlwZSB7IERpYWdub3N0aWNSZWYgfSBmcm9tIFwiQG9wZW5saXVsYW4vY29yZVwiO1xuXG5leHBvcnQgdHlwZSBEaWFnbm9zdGljQ2F0ZWdvcnkgPSBcImNvbnNvbGVcIiB8IFwibmV0d29ya1wiIHwgXCJkb21cIiB8IFwicGVyZm9ybWFuY2VcIiB8IFwianMtZXhjZXB0aW9uXCIgfCBcImFjY2Vzc2liaWxpdHlcIjtcblxuLyoqIFx1OTFDN1x1OTZDNlx1NTY2OFx1N0VERlx1NEUwMFx1NjNBNVx1NTNFM1x1RkYxQVx1NUU5NVx1NUM0Mlx1NUYxNVx1NjRDRVx1NUI5RVx1NzNCMFx1NTE3N1x1NEY1M1x1NzY4NCBDRFAvUGxheXdyaWdodCBcdTkxQzdcdTk2QzZcdTkwM0JcdThGOTEgKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlhZ25vc3RpY0NvbGxlY3RvciB7XG4gIHJlYWRvbmx5IGNhdGVnb3J5OiBEaWFnbm9zdGljQ2F0ZWdvcnk7XG4gIGNvbGxlY3QoKTogUHJvbWlzZTxEaWFnbm9zdGljUmVmW10+O1xufVxuXG4vKiogXHU3RjUxXHU3RURDXHU4QkY3XHU2QzQyXHU4QkIwXHU1RjU1XHVGRjA4XHU3NTI4XHU0RThFXHU1MjA2XHU2NzkwXHU1MkEwXHU4RjdEXHU1OTMxXHU4RDI1L1x1NjE2Mlx1OEJGN1x1NkM0Mlx1RkYwOSAqL1xuZXhwb3J0IGludGVyZmFjZSBOZXR3b3JrUmVjb3JkIHtcbiAgdXJsOiBzdHJpbmc7XG4gIG1ldGhvZDogc3RyaW5nO1xuICBzdGF0dXM6IG51bWJlcjtcbiAgc3RhdHVzVGV4dD86IHN0cmluZztcbiAgbWltZVR5cGU/OiBzdHJpbmc7XG4gIGR1cmF0aW9uTXM6IG51bWJlcjtcbiAgLyoqIFx1OEJGN1x1NkM0Mlx1NTkzMVx1OEQyNS9cdTg4QUJcdTk2M0JcdTY1QURcdTUzOUZcdTU2RTAgKi9cbiAgZXJyb3I/OiBzdHJpbmc7XG4gIHJlcXVlc3RJZD86IHN0cmluZztcbn1cblxuLyoqIERPTSBcdTY4QzBcdTY3RTVcdTdFRDNcdTY3OUMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgRG9tSW5zcGVjdGlvbiB7XG4gIC8qKiBcdTY4QzBcdTY3RTVcdTc2ODRcdTc2RUVcdTY4MDdcdTYzQ0ZcdThGRjAgKi9cbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIC8qKiBcdTUxNDNcdTdEMjAgb3V0bGluZVx1RkYwOFx1NjgwN1x1N0I3RVx1MzAwMWlkXHUzMDAxY2xhc3NcdTMwMDFcdTUxNzNcdTk1MkVcdTVDNUVcdTYwMjdcdUZGMDkgKi9cbiAgb3V0bGluZTogc3RyaW5nO1xuICAvKiogXHU1MTQzXHU3RDIwXHU1M0VGXHU4OUMxXHU2MDI3IC8gXHU0RjREXHU3RjZFICovXG4gIGJveDogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB8IG51bGw7XG4gIC8qKiBcdTY1RTBcdTk2OUNcdTc4OEQvQVJJQSBcdTRGRTFcdTYwNkYgKi9cbiAgYWNjZXNzaWJsZToge1xuICAgIHJvbGU/OiBzdHJpbmc7XG4gICAgbmFtZT86IHN0cmluZztcbiAgICBkaXNhYmxlZD86IGJvb2xlYW47XG4gIH07XG4gIC8qKiBcdTc2RjhcdTUxNzNcdThCQTFcdTdCOTdcdTY4MzdcdTVGMEZcdUZGMDhcdTg4QzFcdTUyNkFcdTRFM0FcdTUxNzNcdTk1MkVcdTk4NzlcdUZGMDkgKi9cbiAgY29tcHV0ZWRTdHlsZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgLyoqIFx1NTQwRVx1NEVFMy9cdTc5NTZcdTUxNDhcdTY5ODJcdTg5QzggKi9cbiAgY29udGV4dDoge1xuICAgIGFuY2VzdG9yczogc3RyaW5nW107XG4gICAgZGVzY2VuZGFudHNDb3VudDogbnVtYmVyO1xuICB9O1xufVxuXG4vKiogXHU2MDI3XHU4MEZEXHU2MzA3XHU2ODA3ICovXG5leHBvcnQgaW50ZXJmYWNlIFBlcmZvcm1hbmNlTWV0cmljcyB7XG4gIC8qKiBuYXZpZ2F0aW9uIHRpbWluZyAqL1xuICB0dGZiOiBudW1iZXI7XG4gIGRvbUNvbnRlbnRMb2FkZWQ6IG51bWJlcjtcbiAgbG9hZEV2ZW50OiBudW1iZXI7XG4gIC8qKiBMYXJnZXN0IENvbnRlbnRmdWwgUGFpbnQgKi9cbiAgbGNwPzogbnVtYmVyO1xuICAvKiogRmlyc3QgQ29udGVudGZ1bCBQYWludCAqL1xuICBmY3A/OiBudW1iZXI7XG4gIC8qKiBcdThENDRcdTZFOTBcdTY1NzBcdTkxQ0ZcdTRFMEVcdTRGNTNcdTc5RUYgKi9cbiAgcmVzb3VyY2VzOiB7IGNvdW50OiBudW1iZXI7IHRvdGFsQnl0ZXM6IG51bWJlciB9O1xuICAvKiogXHU5NTdGXHU0RUZCXHU1MkExXHVGRjA4XHU5NjNCXHU1ODVFXHU0RTNCXHU3RUJGXHU3QTBCXHVGRjA5XHU2QjIxXHU2NTcwICovXG4gIGxvbmdUYXNrczogbnVtYmVyO1xuICAvKiogXHU1MTg1XHU1QjU4XHVGRjA4XHU4RkQxXHU0RjNDXHVGRjA5ICovXG4gIGpzSGVhcFVzZWQ/OiBudW1iZXI7XG59XG5cbi8qKiBcdThCQ0FcdTY1QURcdTYyQTVcdTU0NEFcdTgwNUFcdTU0MDggKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlhZ25vc2lzUmVwb3J0IHtcbiAgY29uc29sZTogRGlhZ25vc3RpY1JlZltdO1xuICBuZXR3b3JrOiBEaWFnbm9zdGljUmVmW107XG4gIGRvbTogRGlhZ25vc3RpY1JlZltdO1xuICBwZXJmb3JtYW5jZTogRGlhZ25vc3RpY1JlZltdO1xuICBqc0V4Y2VwdGlvbnM6IERpYWdub3N0aWNSZWZbXTtcbiAgYWNjZXNzaWJpbGl0eTogRGlhZ25vc3RpY1JlZltdO1xufVxuXG4vKiogXHU4QkNBXHU2NUFEXHU2NDU4XHU4OTgxXHVGRjFBXHU3RUQ5IEFJIFx1NzY4NFx1NEUwMFx1NTNFNVx1OEJERFx1N0VEM1x1OEJCQSAqL1xuZXhwb3J0IGludGVyZmFjZSBEaWFnbm9zaXNTdW1tYXJ5IHtcbiAgLyoqIFx1OTg3NVx1OTc2Mlx1NjYyRlx1NTQyNlx1NTA2NVx1NUVCNyAqL1xuICBoZWFsdGh5OiBib29sZWFuO1xuICAvKiogXHU1MTczXHU5NTJFXHU5NUVFXHU5ODk4XHU1MjE3XHU4ODY4XHVGRjA4XHU2MzA5XHU0RTI1XHU5MUNEXHU1RUE2XHU2MzkyXHU1RThGXHVGRjA5ICovXG4gIGlzc3VlczogQXJyYXk8e1xuICAgIGNhdGVnb3J5OiBEaWFnbm9zdGljQ2F0ZWdvcnk7XG4gICAgc2V2ZXJpdHk6IFwiZXJyb3JcIiB8IFwid2FybmluZ1wiO1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgfT47XG4gIC8qKiBcdTVFRkFcdThCQUVcdUZGMDhcdTRGOUIgQUkgXHU1MUIzXHU3QjU2XHU0RTBCXHU0RTAwXHU2QjY1XHVGRjA5ICovXG4gIHN1Z2dlc3Rpb25zOiBzdHJpbmdbXTtcbn1cbiIsICIvKipcbiAqIERpYWdub3Npc0NlbnRlciBcdTIwMTRcdTIwMTQgXHU4QkNBXHU2NUFEXHU0RTJEXHU1RkMzXHU5NUU4XHU5NzYyXG4gKiBcdTgwNUFcdTU0MDhcdTU0MDRcdTdDN0JcdTkxQzdcdTk2QzZcdTU2NjhcdUZGMENcdTRFQTdcdTUxRkFcdTdFREZcdTRFMDBcdThCQ0FcdTY1QURcdTYyQTVcdTU0NEFcdTRFMEUgQUkgXHU1M0VGXHU4QkZCXHU2NDU4XHU4OTgxXHUzMDAyXG4gKi9cbmltcG9ydCB0eXBlIHsgRGlhZ25vc3RpY1JlZiB9IGZyb20gXCJAb3BlbmxpdWxhbi9jb3JlXCI7XG5pbXBvcnQgdHlwZSB7IERpYWdub3Npc1JlcG9ydCwgRGlhZ25vc2lzU3VtbWFyeSwgRGlhZ25vc3RpY0NvbGxlY3RvciB9IGZyb20gXCIuL3R5cGVzLmpzXCI7XG5pbXBvcnQgeyBzdW1tYXJpemUgfSBmcm9tIFwiLi9hbmFseXplci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgRGlhZ25vc2lzQ2VudGVyIHtcbiAgcHJpdmF0ZSBjb2xsZWN0b3JzOiBEaWFnbm9zdGljQ29sbGVjdG9yW10gPSBbXTtcblxuICAvKiogXHU2Q0U4XHU1MThDXHU5MUM3XHU5NkM2XHU1NjY4XHVGRjA4XHU1RTk1XHU1QzQyXHU1RjE1XHU2NENFXHU2M0QwXHU0RjlCXHVGRjA5ICovXG4gIHJlZ2lzdGVyKGNvbGxlY3RvcjogRGlhZ25vc3RpY0NvbGxlY3Rvcik6IHRoaXMge1xuICAgIHRoaXMuY29sbGVjdG9ycy5wdXNoKGNvbGxlY3Rvcik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogXHU4RkQwXHU4ODRDXHU0RTAwXHU2QjIxXHU1QjhDXHU2NTc0XHU4QkNBXHU2NUFEICovXG4gIGFzeW5jIHJ1bigpOiBQcm9taXNlPERpYWdub3Npc1JlcG9ydD4ge1xuICAgIGNvbnN0IHJlcG9ydDogRGlhZ25vc2lzUmVwb3J0ID0ge1xuICAgICAgY29uc29sZTogW10sXG4gICAgICBuZXR3b3JrOiBbXSxcbiAgICAgIGRvbTogW10sXG4gICAgICBwZXJmb3JtYW5jZTogW10sXG4gICAgICBqc0V4Y2VwdGlvbnM6IFtdLFxuICAgICAgYWNjZXNzaWJpbGl0eTogW10sXG4gICAgfTtcblxuICAgIGNvbnN0IHRhc2tzID0gdGhpcy5jb2xsZWN0b3JzLm1hcChhc3luYyAoYykgPT4ge1xuICAgICAgY29uc3QgcmVmcyA9IGF3YWl0IGMuY29sbGVjdCgpO1xuICAgICAgcmV0dXJuIHsgY2F0ZWdvcnk6IGMuY2F0ZWdvcnksIHJlZnMgfTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQodGFza3MpO1xuICAgIGZvciAoY29uc3QgciBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAoci5zdGF0dXMgPT09IFwiZnVsZmlsbGVkXCIpIHtcbiAgICAgICAgKHJlcG9ydCBhcyBhbnkpW3IudmFsdWUuY2F0ZWdvcnldID0gci52YWx1ZS5yZWZzO1xuICAgICAgfVxuICAgICAgLy8gXHU1MzU1XHU0RTJBXHU5MUM3XHU5NkM2XHU1NjY4XHU1OTMxXHU4RDI1XHU0RTBEXHU1RjcxXHU1NENEXHU2NTc0XHU0RjUzXHU4QkNBXHU2NUFEXG4gICAgfVxuICAgIHJldHVybiByZXBvcnQ7XG4gIH1cblxuICAvKiogXHU4M0I3XHU1M0Q2IEFJIFx1NTNFRlx1OEJGQlx1NjQ1OFx1ODk4MSAqL1xuICBhc3luYyBzdW1tYXJpemUoKTogUHJvbWlzZTxEaWFnbm9zaXNTdW1tYXJ5PiB7XG4gICAgY29uc3QgcmVwb3J0ID0gYXdhaXQgdGhpcy5ydW4oKTtcbiAgICByZXR1cm4gc3VtbWFyaXplKHJlcG9ydCk7XG4gIH1cblxuICAvKiogXHU0RkJGXHU2Mzc3XHVGRjFBXHU5MUM3XHU5NkM2XHU3RjUxXHU3RURDXHU1OTMxXHU4RDI1ICovXG4gIHN0YXRpYyBmbGF0dGVuRXJyb3JzKHJlcG9ydDogRGlhZ25vc2lzUmVwb3J0KTogRGlhZ25vc3RpY1JlZltdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4ucmVwb3J0LmNvbnNvbGUuZmlsdGVyKChjKSA9PiBjLnNldmVyaXR5ID09PSBcImVycm9yXCIpLFxuICAgICAgLi4ucmVwb3J0Lm5ldHdvcmsuZmlsdGVyKChuKSA9PiBuLnNldmVyaXR5ID09PSBcImVycm9yXCIpLFxuICAgICAgLi4ucmVwb3J0LmpzRXhjZXB0aW9ucyxcbiAgICAgIC4uLnJlcG9ydC5wZXJmb3JtYW5jZS5maWx0ZXIoKHApID0+IHAuc2V2ZXJpdHkgPT09IFwiZXJyb3JcIiksXG4gICAgXTtcbiAgfVxufVxuXG5leHBvcnQgKiBmcm9tIFwiLi90eXBlcy5qc1wiO1xuZXhwb3J0IHsgYW5hbHl6ZU5ldHdvcmssIGFuYWx5emVQZXJmb3JtYW5jZSwgc3VtbWFyaXplIH0gZnJvbSBcIi4vYW5hbHl6ZXIuanNcIjtcbiIsICIvKipcclxuICogTUNQIFx1NURFNVx1NTE3N1x1NUI5QVx1NEU0OVxyXG4gKlxyXG4gKiBcdTYyOEEgRm9yZ2UgXHU3Njg0XHU2ODM4XHU1RkMzXHU4MEZEXHU1MjlCXHU1QzAxXHU4OEM1XHU0RTNBXHU2ODA3XHU1MUM2XHU3Njg0IE1DUCBcdTVERTVcdTUxNzdcdTk2QzZcdUZGMENcdTRGOUJcdTRFRkJcdTRGNTUgTUNQIFx1NUJBMlx1NjIzN1x1N0FFRlx1RkYwOFxyXG4gKiBkZWVwc2VlayBoYXJuZXNzXHUzMDAxY25iLmNvb2xcdTMwMDFDbGF1ZGUgRGVza3RvcCBcdTdCNDlcdUZGMDlcdThDMDNcdTc1MjhcdTMwMDJcclxuICpcclxuICogXHU1REU1XHU1MTc3XHU4QkJFXHU4QkExXHU1MzlGXHU1MjE5XHVGRjA4XHU1MDFGXHU5Mjc0IENocm9tZSBEZXZUb29scyBNQ1AgXHU3Njg0XHU4QzAzXHU4QkQ1XHU0RjE4XHU1MTQ4ICsgXHU5QUQ4XHU2NTQ4XHVGRjA5XHVGRjFBXHJcbiAqIC0gb2JzZXJ2ZVx1RkYxQVx1OUFEOFx1NjU0OFx1OTg3NVx1OTc2Mlx1NUZFQlx1NzE2N1x1RkYwOFx1NjZGRlx1NEVFM1x1NTE5N1x1OTU3RiBET00gZHVtcFx1RkYwOVxyXG4gKiAtIGFjdFx1RkYxQVx1N0VERlx1NEUwMFx1NTJBOFx1NEY1Q1x1NjI2N1x1ODg0Q1xyXG4gKiAtIGRpYWdub3NlXHVGRjFBNSBcdTY2MUZcdThDMDNcdThCRDVcdThCQ0FcdTY1QURcclxuICogLSBldmFsXHVGRjFBXHU2Q0U4XHU1MTY1IEpTIFx1OUFEOFx1N0VBN1x1OEJDQVx1NjVBRFxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNY3BUb29sU2NoZW1hIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgZGVzY3JpcHRpb246IHN0cmluZztcclxuICAvKiogSlNPTiBTY2hlbWEgXHU1MTY1XHU1M0MyICovXHJcbiAgaW5wdXRTY2hlbWE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgVE9PTFM6IE1jcFRvb2xTY2hlbWFbXSA9IFtcclxuICB7XHJcbiAgICBuYW1lOiBcIm9ic2VydmVcIixcclxuICAgIGRlc2NyaXB0aW9uOlxyXG4gICAgICBcIlx1ODNCN1x1NTNENlx1NUY1M1x1NTI0RFx1OTg3NVx1OTc2Mlx1NzY4NFx1OUFEOFx1NjU0OFx1NUZFQlx1NzE2N1x1MzAwMlx1OEZENFx1NTZERVx1N0NCRVx1N0I4MFx1NTQwRVx1NzY4NFx1NTNFRlx1NEVBNFx1NEU5Mlx1NTE0M1x1N0QyMFx1N0QyMlx1NUYxNVx1RkYwOFx1NUUyNiByZWZcdUZGMDlcdTRFMEVcdTk4NzVcdTk3NjJcdTdFREZcdThCQTFcdTMwMDJUb2tlbiBcdTUzQ0JcdTU5N0RcdUZGMENcdTY2MkZcdTc0MDZcdTg5RTNcdTk4NzVcdTk3NjJcdTc2ODRcdTk5OTZcdTkwMDlcdTMwMDJcIixcclxuICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXHJcbiAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICBtYXhOb2RlczogeyB0eXBlOiBcIm51bWJlclwiLCBkZXNjcmlwdGlvbjogXCJcdTY3MDBcdTU5MjdcdTgyODJcdTcwQjlcdTY1NzBcdUZGMDhcdTlFRDhcdThCQTQgMjAwXHVGRjA5XCIgfSxcclxuICAgICAgICBtYXhUZXh0TGVuZ3RoOiB7IHR5cGU6IFwibnVtYmVyXCIsIGRlc2NyaXB0aW9uOiBcIlx1NTM1NVx1ODI4Mlx1NzBCOVx1NjU4N1x1NjcyQ1x1NjcwMFx1NTkyN1x1OTU3Rlx1NUVBNlx1RkYwOFx1OUVEOFx1OEJBNCA4MFx1RkYwOVwiIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAge1xyXG4gICAgbmFtZTogXCJhY3RcIixcclxuICAgIGRlc2NyaXB0aW9uOlxyXG4gICAgICBcIlx1NjI2N1x1ODg0Q1x1NEUwMFx1NEUyQVx1N0VERlx1NEUwMFx1NkQ0Rlx1ODlDOFx1NTY2OFx1NTJBOFx1NEY1Q1x1RkYwOG5hdmlnYXRlL2NsaWNrL2ZpbGwvdHlwZS9zZWxlY3QvaG92ZXIvc2Nyb2xsL3ByZXNzL3dhaXQvZXh0cmFjdC9hc3NlcnQvc2NyZWVuc2hvdC9ldmFsdWF0ZVx1RkYwOVx1MzAwMlwiLFxyXG4gICAgaW5wdXRTY2hlbWE6IHtcclxuICAgICAgdHlwZTogXCJvYmplY3RcIixcclxuICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgIHR5cGU6IHtcclxuICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXHJcbiAgICAgICAgICBlbnVtOiBbXCJuYXZpZ2F0ZVwiLCBcImNsaWNrXCIsIFwiZmlsbFwiLCBcInR5cGVcIiwgXCJzZWxlY3RcIiwgXCJob3ZlclwiLCBcInNjcm9sbFwiLCBcInByZXNzXCIsIFwid2FpdFwiLCBcImV4dHJhY3RcIiwgXCJhc3NlcnRcIiwgXCJzY3JlZW5zaG90XCIsIFwiZXZhbHVhdGVcIl0sXHJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogXCJcdTUyQThcdTRGNUNcdTdDN0JcdTU3OEJcIixcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcclxuICAgICAgICAvLyBcdTkwMUFcdTc1MjhcdTVCOUFcdTRGNERcclxuICAgICAgICByZWY6IHsgdHlwZTogXCJzdHJpbmdcIiwgZGVzY3JpcHRpb246IFwib2JzZXJ2ZSBcdThGRDRcdTU2REVcdTc2ODRcdTUxNDNcdTdEMjAgcmVmXHVGRjA4XHU2NzAwXHU3Q0JFXHU3ODZFXHVGRjA5XCIgfSxcclxuICAgICAgICBzZWxlY3RvcjogeyB0eXBlOiBcInN0cmluZ1wiLCBkZXNjcmlwdGlvbjogXCJDU1MgXHU5MDA5XHU2MkU5XHU1NjY4XCIgfSxcclxuICAgICAgICB0ZXh0OiB7IHR5cGU6IFwic3RyaW5nXCIsIGRlc2NyaXB0aW9uOiBcIlx1N0NCRVx1Nzg2RVx1NjU4N1x1NjcyQ1x1NUI5QVx1NEY0RFwiIH0sXHJcbiAgICAgICAgc2VtYW50aWM6IHsgdHlwZTogXCJzdHJpbmdcIiwgZGVzY3JpcHRpb246IFwiXHU4QkVEXHU0RTQ5XHU2M0NGXHU4RkYwXHU1QjlBXHU0RjREXCIgfSxcclxuICAgICAgICAvLyBcdTUyQThcdTRGNUNcdTUzQzJcdTY1NzBcclxuICAgICAgICB1cmw6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxyXG4gICAgICAgIHZhbHVlOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcclxuICAgICAgICBrZXk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxyXG4gICAgICAgIG1zOiB7IHR5cGU6IFwibnVtYmVyXCIgfSxcclxuICAgICAgICBzY3JpcHQ6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxyXG4gICAgICAgIG1vZGU6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxyXG4gICAgICAgIGV4cGVjdGVkOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcclxuICAgICAgICAvLyBcdTYyMkFcdTU2RkUvXHU2RURBXHU1MkE4L1x1OEY5M1x1NTE2NS9cdTVCRkNcdTgyMkFcdTdFQzZcdTgyODJcdUZGMDhcdTRGOUIgSURFIFx1NzY4NCBmdW5jdGlvbiBjYWxsaW5nIFx1NUI4Q1x1NjU3NFx1NThGMFx1NjYwRVx1RkYwQ1x1OTA3Rlx1NTE0RFx1ODBGRFx1NTI5Qlx1ODhBQlx1OTY5MFx1ODVDRlx1RkYwOVxyXG4gICAgICAgIGZ1bGxQYWdlOiB7IHR5cGU6IFwiYm9vbGVhblwiLCBkZXNjcmlwdGlvbjogXCJzY3JlZW5zaG90IFx1NjVGNlx1NjYyRlx1NTQyNlx1NjU3NFx1OTg3NVx1NjIyQVx1NTZGRVwiIH0sXHJcbiAgICAgICAgZGVsdGFZOiB7IHR5cGU6IFwibnVtYmVyXCIsIGRlc2NyaXB0aW9uOiBcInNjcm9sbCBcdTY1RjZcdTU3ODJcdTc2RjRcdTZFREFcdTUyQThcdThERERcdTc5QkJcIiB9LFxyXG4gICAgICAgIGRlbGF5OiB7IHR5cGU6IFwibnVtYmVyXCIsIGRlc2NyaXB0aW9uOiBcInR5cGUgXHU2NUY2XHU5MDEwXHU5NTJFXHU4RjkzXHU1MTY1XHU1RUY2XHU4RkRGKG1zKVwiIH0sXHJcbiAgICAgICAgd2FpdFVudGlsOiB7IHR5cGU6IFwic3RyaW5nXCIsIGVudW06IFtcImxvYWRcIiwgXCJkb21jb250ZW50bG9hZGVkXCIsIFwibmV0d29ya2lkbGVcIiwgXCJjb21taXRcIl0sIGRlc2NyaXB0aW9uOiBcIm5hdmlnYXRlIFx1NjVGNlx1N0I0OVx1NUY4NVx1N0I1Nlx1NzU2NVwiIH0sXHJcbiAgICAgICAgd2FpdEZvck5hdmlnYXRpb246IHsgdHlwZTogXCJib29sZWFuXCIsIGRlc2NyaXB0aW9uOiBcImNsaWNrIFx1NjVGNlx1NjYyRlx1NTQyNlx1N0I0OVx1NUY4NVx1NUJGQ1x1ODIyQVx1N0EzM1x1NUI5QVx1RkYwOFx1NzBCOVx1NTFGQlx1OTRGRVx1NjNBNVx1ODlFNlx1NTNEMVx1OERGM1x1OEY2Q1x1NjVGNlx1RkYwOVwiIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHJlcXVpcmVkOiBbXCJ0eXBlXCJdLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHtcclxuICAgIG5hbWU6IFwiZGlhZ25vc2VcIixcclxuICAgIGRlc2NyaXB0aW9uOlxyXG4gICAgICBcIlx1OEZEMFx1ODg0QyA1IFx1NjYxRlx1OEMwM1x1OEJENVx1OEJDQVx1NjVBRFx1RkYwQ1x1OTFDN1x1OTZDNlx1NjNBN1x1NTIzNlx1NTNGMFx1OTUxOVx1OEJFRlx1MzAwMVx1N0Y1MVx1N0VEQ1x1NTkzMVx1OEQyNVx1MzAwMUpTIFx1NUYwMlx1NUUzOFx1MzAwMVx1NjAyN1x1ODBGRFx1NjMwN1x1NjgwN1x1RkYwQ1x1NUU3Nlx1OEZENFx1NTZERVx1NTA2NVx1NUVCN1x1NUVBNlx1NEUwRSBBSSBcdTUzRUZcdThCRkJcdTVFRkFcdThCQUVcdTMwMDJcdTUyQThcdTRGNUNcdTU5MzFcdThEMjVcdTU0MEVcdTgxRUFcdTUyQThcdThCQ0FcdTY1QURcdTMwMDJcIixcclxuICAgIGlucHV0U2NoZW1hOiB7IHR5cGU6IFwib2JqZWN0XCIsIHByb3BlcnRpZXM6IHt9IH0sXHJcbiAgfSxcclxuICB7XHJcbiAgICBuYW1lOiBcImV2YWxcIixcclxuICAgIGRlc2NyaXB0aW9uOiBcIlx1NTcyOFx1OTg3NVx1OTc2Mlx1NkNFOFx1NTE2NVx1NjI2N1x1ODg0QyBKYXZhU2NyaXB0XHVGRjBDXHU3NTI4XHU0RThFXHU5QUQ4XHU3RUE3XHU4QkNBXHU2NUFEXHU0RTBFXHU3MkI2XHU2MDAxXHU2OEMwXHU2N0U1XHUzMDAyXCIsXHJcbiAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICB0eXBlOiBcIm9iamVjdFwiLFxyXG4gICAgICBwcm9wZXJ0aWVzOiB7IHNjcmlwdDogeyB0eXBlOiBcInN0cmluZ1wiLCBkZXNjcmlwdGlvbjogXCJcdTg5ODFcdTYyNjdcdTg4NENcdTc2ODQgSlMgXHU4ODY4XHU4RkJFXHU1RjBGL1x1OEJFRFx1NTNFNVwiIH0gfSxcclxuICAgICAgcmVxdWlyZWQ6IFtcInNjcmlwdFwiXSxcclxuICAgIH0sXHJcbiAgfSxcclxuICB7XHJcbiAgICBuYW1lOiBcInNjcmVlbnNob3RcIixcclxuICAgIGRlc2NyaXB0aW9uOlxyXG4gICAgICBcIlx1NjIyQVx1NTNENlx1NUY1M1x1NTI0RFx1OTg3NVx1OTc2Mlx1RkYwOFx1NTNFRlx1NjU3NFx1OTg3NVx1RkYwOVx1RkYwQ1x1OEZENFx1NTZERSBiYXNlNjQgXHU1NkZFXHU3MjQ3XHVGRjBDXHU3NTI4XHU0RThFXHU4OUM2XHU4OUM5XHU3ODZFXHU4QkE0XHUzMDAyXHU2MjJBXHU1NkZFXHU0RjFBXHU0RjVDXHU0RTNBXHU1NkZFXHU3MjQ3XHU0RThCXHU0RUY2XHU1MTk5XHU1MTY1XHU0RjFBXHU4QkREXHU2NUU1XHU1RkQ3XHVGRjBDXHU0RjlCXHU1OTFBXHU2QTIxXHU2MDAxIEFJIFx1NkQ4OFx1OEQzOVx1MzAwMlwiLFxyXG4gICAgaW5wdXRTY2hlbWE6IHtcclxuICAgICAgdHlwZTogXCJvYmplY3RcIixcclxuICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgIGZ1bGxQYWdlOiB7IHR5cGU6IFwiYm9vbGVhblwiLCBkZXNjcmlwdGlvbjogXCJcdTY2MkZcdTU0MjZcdTY1NzRcdTk4NzVcdTYyMkFcdTU2RkVcIiB9LFxyXG4gICAgICAgIGNhcHRpb246IHsgdHlwZTogXCJzdHJpbmdcIiwgZGVzY3JpcHRpb246IFwiXHU2MjJBXHU1NkZFXHU4QkY0XHU2NjBFXHVGRjA4XHU1MTk5XHU1MTY1XHU2NUU1XHU1RkQ3XHU0RThCXHU0RUY2XHVGRjA5XCIgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICB7XHJcbiAgICBuYW1lOiBcInNlc3Npb25fbG9nXCIsXHJcbiAgICBkZXNjcmlwdGlvbjpcclxuICAgICAgXCJcdTgzQjdcdTUzRDZcdTVGNTNcdTUyNERcdTRGMUFcdThCRERcdTc2ODRcdTRFOEJcdTRFRjZcdTY1RTVcdTVGRDdcdTZENDFcdUZGMDhcdTUyQThcdTRGNUMvXHU4QkNBXHU2NUFEL1x1OTUxOVx1OEJFRi9cdTYyMkFcdTU2RkVcdThGNjhcdThGRjlcdUZGMDlcdTMwMDJcdThGRDlcdTY2MkYgQUkgXHU1MzRGXHU0RjVDXHU3Njg0XHU4RkZEXHU4RTJBXHU4MEZEXHU1MjlCXHVGRjFBXHU4QkE5XHU1OTE2XHU5MEU4IEFJIFx1NzcwQlx1NTIzMFx1MzAwRVx1NTNEMVx1NzUxRlx1NEU4Nlx1NEVDMFx1NEU0OCArIFx1NEUzQVx1NEVDMFx1NEU0OFx1NTkzMVx1OEQyNSArIFx1NUVGQVx1OEJBRVx1MzAwRlx1MzAwMmZvcm1hdD1qc29uIFx1OEZENFx1NTZERVx1N0VEM1x1Njc4NFx1NTMxNlx1NEU4Qlx1NEVGNlx1RkYwQ1x1OUVEOFx1OEJBNFx1OEZENFx1NTZERSBtYXJrZG93blx1MzAwMlwiLFxyXG4gICAgaW5wdXRTY2hlbWE6IHtcclxuICAgICAgdHlwZTogXCJvYmplY3RcIixcclxuICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgIGZvcm1hdDogeyB0eXBlOiBcInN0cmluZ1wiLCBlbnVtOiBbXCJtYXJrZG93blwiLCBcImpzb25cIl0sIGRlc2NyaXB0aW9uOiBcIlx1OEY5M1x1NTFGQVx1NjgzQ1x1NUYwRlx1RkYwQ1x1OUVEOFx1OEJBNCBtYXJrZG93blwiIH0sXHJcbiAgICAgICAgdGl0bGU6IHsgdHlwZTogXCJzdHJpbmdcIiwgZGVzY3JpcHRpb246IFwibWFya2Rvd24gXHU2MkE1XHU1NDRBXHU2ODA3XHU5ODk4XCIgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICB7XHJcbiAgICBuYW1lOiBcImNsb3NlXCIsXHJcbiAgICBkZXNjcmlwdGlvbjogXCJcdTUxNzNcdTk1RURcdTZENEZcdTg5QzhcdTU2NjhcdUZGMENcdTdFRDNcdTY3NUZcdTRGMUFcdThCRERcdTMwMDJcIixcclxuICAgIGlucHV0U2NoZW1hOiB7IHR5cGU6IFwib2JqZWN0XCIsIHByb3BlcnRpZXM6IHt9IH0sXHJcbiAgfSxcclxuICB7XHJcbiAgICBuYW1lOiBcInN0ZWFsdGhfc3RhdHVzXCIsXHJcbiAgICBkZXNjcmlwdGlvbjogXCJcdTY3RTVcdTc3MEJcdTk2MzJcdTY4QzBcdTZENEJcdUZGMDhTdGVhbHRoXHVGRjA5XHU2QTIxXHU1NzU3XHU3MkI2XHU2MDAxXHVGRjFBXHU2NjJGXHU1NDI2XHU1NDJGXHU3NTI4XHUzMDAxXHU3RUE3XHU1MjJCXHUzMDAxVUEgXHU3QjU2XHU3NTY1XHU3QjQ5XHUzMDAyXHU5NjMyXHU2OEMwXHU2RDRCXHU3NTI4XHU0RThFXHU5MDdGXHU1MTREXHU4OEFCXHU3NkVFXHU2ODA3XHU3QUQ5XHU3MEI5XHU4QkM2XHU1MjJCXHU0RTNBXHU3MjJDXHU4NjZCXHU4MDBDXHU5NjUwXHU5MDFGL1x1NUMwMVx1Nzk4MVx1MzAwMlwiLFxyXG4gICAgaW5wdXRTY2hlbWE6IHsgdHlwZTogXCJvYmplY3RcIiwgcHJvcGVydGllczoge30gfSxcclxuICB9LFxyXG5dO1xyXG5cclxuLyoqIFx1NURFNVx1NTE3N1x1OEMwM1x1NzUyOFx1N0VEM1x1Njc5Q1x1RkYwOFx1NTM0Rlx1OEJBRVx1NjVFMFx1NTE3M1x1NzY4NFx1NjgwN1x1NTFDNlx1NTRDRFx1NUU5NFx1N0VEM1x1Njc4NFx1RkYwOSAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFRvb2xSZXN1bHQge1xyXG4gIC8qKiBcdTY2MkZcdTU0MjZcdTYyMTBcdTUyOUYgKi9cclxuICBvazogYm9vbGVhbjtcclxuICAvKiogXHU0RjlCIEFJIFx1OTYwNVx1OEJGQlx1NzY4NFx1NjU4N1x1NjcyQyAqL1xyXG4gIGNvbnRlbnQ6IEFycmF5PHsgdHlwZTogXCJ0ZXh0XCI7IHRleHQ6IHN0cmluZyB9PjtcclxuICAvKiogXHU3RUQzXHU2Nzg0XHU1MzE2XHU2NTcwXHU2MzZFXHVGRjA4XHU1OTgyXHU2MjJBXHU1NkZFIGJhc2U2NFx1RkYwOSAqL1xyXG4gIHN0cnVjdHVyZWQ/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcclxuICAvKiogXHU5NTE5XHU4QkVGXHU0RkUxXHU2MDZGICovXHJcbiAgaXNFcnJvcj86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKiBcdTYyOEFcdTRFRkJcdTYxMEZcdTdFRDNcdTY3OUNcdTUzMDVcdTg4QzVcdTRFM0FcdTY4MDdcdTUxQzYgVG9vbFJlc3VsdCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gb2tSZXN1bHQodGV4dDogc3RyaW5nLCBzdHJ1Y3R1cmVkPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBUb29sUmVzdWx0IHtcclxuICByZXR1cm4geyBvazogdHJ1ZSwgY29udGVudDogW3sgdHlwZTogXCJ0ZXh0XCIsIHRleHQgfV0sIHN0cnVjdHVyZWQgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGVyclJlc3VsdCh0ZXh0OiBzdHJpbmcpOiBUb29sUmVzdWx0IHtcclxuICByZXR1cm4geyBvazogZmFsc2UsIGNvbnRlbnQ6IFt7IHR5cGU6IFwidGV4dFwiLCB0ZXh0IH1dLCBpc0Vycm9yOiB0cnVlIH07XHJcbn1cclxuIiwgImV4cG9ydCAqIGZyb20gXCIuL2Vycm9ycy5qc1wiO1xuZXhwb3J0ICogZnJvbSBcIi4vaGVscGVycy9wYXJzZVV0aWwuanNcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2hlbHBlcnMvdHlwZUFsaWFzZXMuanNcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2hlbHBlcnMvdXRpbC5qc1wiO1xuZXhwb3J0ICogZnJvbSBcIi4vdHlwZXMuanNcIjtcbmV4cG9ydCAqIGZyb20gXCIuL1pvZEVycm9yLmpzXCI7XG4iLCAiZXhwb3J0IHZhciB1dGlsO1xuKGZ1bmN0aW9uICh1dGlsKSB7XG4gICAgdXRpbC5hc3NlcnRFcXVhbCA9IChfKSA9PiB7IH07XG4gICAgZnVuY3Rpb24gYXNzZXJ0SXMoX2FyZykgeyB9XG4gICAgdXRpbC5hc3NlcnRJcyA9IGFzc2VydElzO1xuICAgIGZ1bmN0aW9uIGFzc2VydE5ldmVyKF94KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgIH1cbiAgICB1dGlsLmFzc2VydE5ldmVyID0gYXNzZXJ0TmV2ZXI7XG4gICAgdXRpbC5hcnJheVRvRW51bSA9IChpdGVtcykgPT4ge1xuICAgICAgICBjb25zdCBvYmogPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgICAgICBvYmpbaXRlbV0gPSBpdGVtO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcbiAgICB1dGlsLmdldFZhbGlkRW51bVZhbHVlcyA9IChvYmopID0+IHtcbiAgICAgICAgY29uc3QgdmFsaWRLZXlzID0gdXRpbC5vYmplY3RLZXlzKG9iaikuZmlsdGVyKChrKSA9PiB0eXBlb2Ygb2JqW29ialtrXV0gIT09IFwibnVtYmVyXCIpO1xuICAgICAgICBjb25zdCBmaWx0ZXJlZCA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGsgb2YgdmFsaWRLZXlzKSB7XG4gICAgICAgICAgICBmaWx0ZXJlZFtrXSA9IG9ialtrXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXRpbC5vYmplY3RWYWx1ZXMoZmlsdGVyZWQpO1xuICAgIH07XG4gICAgdXRpbC5vYmplY3RWYWx1ZXMgPSAob2JqKSA9PiB7XG4gICAgICAgIHJldHVybiB1dGlsLm9iamVjdEtleXMob2JqKS5tYXAoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBvYmpbZV07XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgdXRpbC5vYmplY3RLZXlzID0gdHlwZW9mIE9iamVjdC5rZXlzID09PSBcImZ1bmN0aW9uXCIgLy8gZXNsaW50LWRpc2FibGUtbGluZSBiYW4vYmFuXG4gICAgICAgID8gKG9iaikgPT4gT2JqZWN0LmtleXMob2JqKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGJhbi9iYW5cbiAgICAgICAgOiAob2JqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBrZXlzID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBrZXlzLnB1c2goa2V5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ga2V5cztcbiAgICAgICAgfTtcbiAgICB1dGlsLmZpbmQgPSAoYXJyLCBjaGVja2VyKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBhcnIpIHtcbiAgICAgICAgICAgIGlmIChjaGVja2VyKGl0ZW0pKVxuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfTtcbiAgICB1dGlsLmlzSW50ZWdlciA9IHR5cGVvZiBOdW1iZXIuaXNJbnRlZ2VyID09PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgPyAodmFsKSA9PiBOdW1iZXIuaXNJbnRlZ2VyKHZhbCkgLy8gZXNsaW50LWRpc2FibGUtbGluZSBiYW4vYmFuXG4gICAgICAgIDogKHZhbCkgPT4gdHlwZW9mIHZhbCA9PT0gXCJudW1iZXJcIiAmJiBOdW1iZXIuaXNGaW5pdGUodmFsKSAmJiBNYXRoLmZsb29yKHZhbCkgPT09IHZhbDtcbiAgICBmdW5jdGlvbiBqb2luVmFsdWVzKGFycmF5LCBzZXBhcmF0b3IgPSBcIiB8IFwiKSB7XG4gICAgICAgIHJldHVybiBhcnJheS5tYXAoKHZhbCkgPT4gKHR5cGVvZiB2YWwgPT09IFwic3RyaW5nXCIgPyBgJyR7dmFsfSdgIDogdmFsKSkuam9pbihzZXBhcmF0b3IpO1xuICAgIH1cbiAgICB1dGlsLmpvaW5WYWx1ZXMgPSBqb2luVmFsdWVzO1xuICAgIHV0aWwuanNvblN0cmluZ2lmeVJlcGxhY2VyID0gKF8sIHZhbHVlKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYmlnaW50XCIpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xufSkodXRpbCB8fCAodXRpbCA9IHt9KSk7XG5leHBvcnQgdmFyIG9iamVjdFV0aWw7XG4oZnVuY3Rpb24gKG9iamVjdFV0aWwpIHtcbiAgICBvYmplY3RVdGlsLm1lcmdlU2hhcGVzID0gKGZpcnN0LCBzZWNvbmQpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmZpcnN0LFxuICAgICAgICAgICAgLi4uc2Vjb25kLCAvLyBzZWNvbmQgb3ZlcndyaXRlcyBmaXJzdFxuICAgICAgICB9O1xuICAgIH07XG59KShvYmplY3RVdGlsIHx8IChvYmplY3RVdGlsID0ge30pKTtcbmV4cG9ydCBjb25zdCBab2RQYXJzZWRUeXBlID0gdXRpbC5hcnJheVRvRW51bShbXG4gICAgXCJzdHJpbmdcIixcbiAgICBcIm5hblwiLFxuICAgIFwibnVtYmVyXCIsXG4gICAgXCJpbnRlZ2VyXCIsXG4gICAgXCJmbG9hdFwiLFxuICAgIFwiYm9vbGVhblwiLFxuICAgIFwiZGF0ZVwiLFxuICAgIFwiYmlnaW50XCIsXG4gICAgXCJzeW1ib2xcIixcbiAgICBcImZ1bmN0aW9uXCIsXG4gICAgXCJ1bmRlZmluZWRcIixcbiAgICBcIm51bGxcIixcbiAgICBcImFycmF5XCIsXG4gICAgXCJvYmplY3RcIixcbiAgICBcInVua25vd25cIixcbiAgICBcInByb21pc2VcIixcbiAgICBcInZvaWRcIixcbiAgICBcIm5ldmVyXCIsXG4gICAgXCJtYXBcIixcbiAgICBcInNldFwiLFxuXSk7XG5leHBvcnQgY29uc3QgZ2V0UGFyc2VkVHlwZSA9IChkYXRhKSA9PiB7XG4gICAgY29uc3QgdCA9IHR5cGVvZiBkYXRhO1xuICAgIHN3aXRjaCAodCkge1xuICAgICAgICBjYXNlIFwidW5kZWZpbmVkXCI6XG4gICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS51bmRlZmluZWQ7XG4gICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLnN0cmluZztcbiAgICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgICAgICAgcmV0dXJuIE51bWJlci5pc05hTihkYXRhKSA/IFpvZFBhcnNlZFR5cGUubmFuIDogWm9kUGFyc2VkVHlwZS5udW1iZXI7XG4gICAgICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS5ib29sZWFuO1xuICAgICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLmZ1bmN0aW9uO1xuICAgICAgICBjYXNlIFwiYmlnaW50XCI6XG4gICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS5iaWdpbnQ7XG4gICAgICAgIGNhc2UgXCJzeW1ib2xcIjpcbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLnN5bWJvbDtcbiAgICAgICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS5hcnJheTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkYXRhID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUubnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkYXRhLnRoZW4gJiYgdHlwZW9mIGRhdGEudGhlbiA9PT0gXCJmdW5jdGlvblwiICYmIGRhdGEuY2F0Y2ggJiYgdHlwZW9mIGRhdGEuY2F0Y2ggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLnByb21pc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIE1hcCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkYXRhIGluc3RhbmNlb2YgTWFwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUubWFwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGVvZiBTZXQgIT09IFwidW5kZWZpbmVkXCIgJiYgZGF0YSBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgRGF0ZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkYXRhIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLmRhdGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS5vYmplY3Q7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS51bmtub3duO1xuICAgIH1cbn07XG4iLCAiaW1wb3J0IHsgdXRpbCB9IGZyb20gXCIuL2hlbHBlcnMvdXRpbC5qc1wiO1xuZXhwb3J0IGNvbnN0IFpvZElzc3VlQ29kZSA9IHV0aWwuYXJyYXlUb0VudW0oW1xuICAgIFwiaW52YWxpZF90eXBlXCIsXG4gICAgXCJpbnZhbGlkX2xpdGVyYWxcIixcbiAgICBcImN1c3RvbVwiLFxuICAgIFwiaW52YWxpZF91bmlvblwiLFxuICAgIFwiaW52YWxpZF91bmlvbl9kaXNjcmltaW5hdG9yXCIsXG4gICAgXCJpbnZhbGlkX2VudW1fdmFsdWVcIixcbiAgICBcInVucmVjb2duaXplZF9rZXlzXCIsXG4gICAgXCJpbnZhbGlkX2FyZ3VtZW50c1wiLFxuICAgIFwiaW52YWxpZF9yZXR1cm5fdHlwZVwiLFxuICAgIFwiaW52YWxpZF9kYXRlXCIsXG4gICAgXCJpbnZhbGlkX3N0cmluZ1wiLFxuICAgIFwidG9vX3NtYWxsXCIsXG4gICAgXCJ0b29fYmlnXCIsXG4gICAgXCJpbnZhbGlkX2ludGVyc2VjdGlvbl90eXBlc1wiLFxuICAgIFwibm90X211bHRpcGxlX29mXCIsXG4gICAgXCJub3RfZmluaXRlXCIsXG5dKTtcbmV4cG9ydCBjb25zdCBxdW90ZWxlc3NKc29uID0gKG9iaikgPT4ge1xuICAgIGNvbnN0IGpzb24gPSBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDIpO1xuICAgIHJldHVybiBqc29uLnJlcGxhY2UoL1wiKFteXCJdKylcIjovZywgXCIkMTpcIik7XG59O1xuZXhwb3J0IGNsYXNzIFpvZEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAgIGdldCBlcnJvcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzc3VlcztcbiAgICB9XG4gICAgY29uc3RydWN0b3IoaXNzdWVzKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuaXNzdWVzID0gW107XG4gICAgICAgIHRoaXMuYWRkSXNzdWUgPSAoc3ViKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmlzc3VlcyA9IFsuLi50aGlzLmlzc3Vlcywgc3ViXTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5hZGRJc3N1ZXMgPSAoc3VicyA9IFtdKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmlzc3VlcyA9IFsuLi50aGlzLmlzc3VlcywgLi4uc3Vic107XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGFjdHVhbFByb3RvID0gbmV3LnRhcmdldC5wcm90b3R5cGU7XG4gICAgICAgIGlmIChPYmplY3Quc2V0UHJvdG90eXBlT2YpIHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBiYW4vYmFuXG4gICAgICAgICAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgYWN0dWFsUHJvdG8pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fX3Byb3RvX18gPSBhY3R1YWxQcm90bztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm5hbWUgPSBcIlpvZEVycm9yXCI7XG4gICAgICAgIHRoaXMuaXNzdWVzID0gaXNzdWVzO1xuICAgIH1cbiAgICBmb3JtYXQoX21hcHBlcikge1xuICAgICAgICBjb25zdCBtYXBwZXIgPSBfbWFwcGVyIHx8XG4gICAgICAgICAgICBmdW5jdGlvbiAoaXNzdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNzdWUubWVzc2FnZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIGNvbnN0IGZpZWxkRXJyb3JzID0geyBfZXJyb3JzOiBbXSB9O1xuICAgICAgICBjb25zdCBwcm9jZXNzRXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaXNzdWUgb2YgZXJyb3IuaXNzdWVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzc3VlLmNvZGUgPT09IFwiaW52YWxpZF91bmlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzc3VlLnVuaW9uRXJyb3JzLm1hcChwcm9jZXNzRXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS5jb2RlID09PSBcImludmFsaWRfcmV0dXJuX3R5cGVcIikge1xuICAgICAgICAgICAgICAgICAgICBwcm9jZXNzRXJyb3IoaXNzdWUucmV0dXJuVHlwZUVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUuY29kZSA9PT0gXCJpbnZhbGlkX2FyZ3VtZW50c1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3NFcnJvcihpc3N1ZS5hcmd1bWVudHNFcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGlzc3VlLnBhdGgubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpZWxkRXJyb3JzLl9lcnJvcnMucHVzaChtYXBwZXIoaXNzdWUpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjdXJyID0gZmllbGRFcnJvcnM7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBpc3N1ZS5wYXRoLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZWwgPSBpc3N1ZS5wYXRoW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVybWluYWwgPSBpID09PSBpc3N1ZS5wYXRoLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRlcm1pbmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycltlbF0gPSBjdXJyW2VsXSB8fCB7IF9lcnJvcnM6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgKHR5cGVvZiBlbCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgY3VycltlbF0gPSBjdXJyW2VsXSB8fCB7IF9lcnJvcnM6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gfSBlbHNlIGlmICh0eXBlb2YgZWwgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgIGNvbnN0IGVycm9yQXJyYXk6IGFueSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgZXJyb3JBcnJheS5fZXJyb3JzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICBjdXJyW2VsXSA9IGN1cnJbZWxdIHx8IGVycm9yQXJyYXk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycltlbF0gPSBjdXJyW2VsXSB8fCB7IF9lcnJvcnM6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycltlbF0uX2Vycm9ycy5wdXNoKG1hcHBlcihpc3N1ZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY3VyciA9IGN1cnJbZWxdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBwcm9jZXNzRXJyb3IodGhpcyk7XG4gICAgICAgIHJldHVybiBmaWVsZEVycm9ycztcbiAgICB9XG4gICAgc3RhdGljIGFzc2VydCh2YWx1ZSkge1xuICAgICAgICBpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIFpvZEVycm9yKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb3QgYSBab2RFcnJvcjogJHt2YWx1ZX1gKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWVzc2FnZTtcbiAgICB9XG4gICAgZ2V0IG1lc3NhZ2UoKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLmlzc3VlcywgdXRpbC5qc29uU3RyaW5naWZ5UmVwbGFjZXIsIDIpO1xuICAgIH1cbiAgICBnZXQgaXNFbXB0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNzdWVzLmxlbmd0aCA9PT0gMDtcbiAgICB9XG4gICAgZmxhdHRlbihtYXBwZXIgPSAoaXNzdWUpID0+IGlzc3VlLm1lc3NhZ2UpIHtcbiAgICAgICAgY29uc3QgZmllbGRFcnJvcnMgPSB7fTtcbiAgICAgICAgY29uc3QgZm9ybUVycm9ycyA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN1YiBvZiB0aGlzLmlzc3Vlcykge1xuICAgICAgICAgICAgaWYgKHN1Yi5wYXRoLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXJzdEVsID0gc3ViLnBhdGhbMF07XG4gICAgICAgICAgICAgICAgZmllbGRFcnJvcnNbZmlyc3RFbF0gPSBmaWVsZEVycm9yc1tmaXJzdEVsXSB8fCBbXTtcbiAgICAgICAgICAgICAgICBmaWVsZEVycm9yc1tmaXJzdEVsXS5wdXNoKG1hcHBlcihzdWIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvcm1FcnJvcnMucHVzaChtYXBwZXIoc3ViKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgZm9ybUVycm9ycywgZmllbGRFcnJvcnMgfTtcbiAgICB9XG4gICAgZ2V0IGZvcm1FcnJvcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZsYXR0ZW4oKTtcbiAgICB9XG59XG5ab2RFcnJvci5jcmVhdGUgPSAoaXNzdWVzKSA9PiB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgWm9kRXJyb3IoaXNzdWVzKTtcbiAgICByZXR1cm4gZXJyb3I7XG59O1xuIiwgImltcG9ydCB7IFpvZElzc3VlQ29kZSB9IGZyb20gXCIuLi9ab2RFcnJvci5qc1wiO1xuaW1wb3J0IHsgdXRpbCwgWm9kUGFyc2VkVHlwZSB9IGZyb20gXCIuLi9oZWxwZXJzL3V0aWwuanNcIjtcbmNvbnN0IGVycm9yTWFwID0gKGlzc3VlLCBfY3R4KSA9PiB7XG4gICAgbGV0IG1lc3NhZ2U7XG4gICAgc3dpdGNoIChpc3N1ZS5jb2RlKSB7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZTpcbiAgICAgICAgICAgIGlmIChpc3N1ZS5yZWNlaXZlZCA9PT0gWm9kUGFyc2VkVHlwZS51bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJSZXF1aXJlZFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBFeHBlY3RlZCAke2lzc3VlLmV4cGVjdGVkfSwgcmVjZWl2ZWQgJHtpc3N1ZS5yZWNlaXZlZH1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfbGl0ZXJhbDpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBsaXRlcmFsIHZhbHVlLCBleHBlY3RlZCAke0pTT04uc3RyaW5naWZ5KGlzc3VlLmV4cGVjdGVkLCB1dGlsLmpzb25TdHJpbmdpZnlSZXBsYWNlcil9YDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS51bnJlY29nbml6ZWRfa2V5czpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgVW5yZWNvZ25pemVkIGtleShzKSBpbiBvYmplY3Q6ICR7dXRpbC5qb2luVmFsdWVzKGlzc3VlLmtleXMsIFwiLCBcIil9YDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5pbnZhbGlkX3VuaW9uOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnZhbGlkIGlucHV0YDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5pbnZhbGlkX3VuaW9uX2Rpc2NyaW1pbmF0b3I6XG4gICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgZGlzY3JpbWluYXRvciB2YWx1ZS4gRXhwZWN0ZWQgJHt1dGlsLmpvaW5WYWx1ZXMoaXNzdWUub3B0aW9ucyl9YDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5pbnZhbGlkX2VudW1fdmFsdWU6XG4gICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgZW51bSB2YWx1ZS4gRXhwZWN0ZWQgJHt1dGlsLmpvaW5WYWx1ZXMoaXNzdWUub3B0aW9ucyl9LCByZWNlaXZlZCAnJHtpc3N1ZS5yZWNlaXZlZH0nYDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5pbnZhbGlkX2FyZ3VtZW50czpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBmdW5jdGlvbiBhcmd1bWVudHNgO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfcmV0dXJuX3R5cGU6XG4gICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgZnVuY3Rpb24gcmV0dXJuIHR5cGVgO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfZGF0ZTpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBkYXRlYDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaXNzdWUudmFsaWRhdGlvbiA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIGlmIChcImluY2x1ZGVzXCIgaW4gaXNzdWUudmFsaWRhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgaW5wdXQ6IG11c3QgaW5jbHVkZSBcIiR7aXNzdWUudmFsaWRhdGlvbi5pbmNsdWRlc31cImA7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXNzdWUudmFsaWRhdGlvbi5wb3NpdGlvbiA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IGAke21lc3NhZ2V9IGF0IG9uZSBvciBtb3JlIHBvc2l0aW9ucyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gJHtpc3N1ZS52YWxpZGF0aW9uLnBvc2l0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoXCJzdGFydHNXaXRoXCIgaW4gaXNzdWUudmFsaWRhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgaW5wdXQ6IG11c3Qgc3RhcnQgd2l0aCBcIiR7aXNzdWUudmFsaWRhdGlvbi5zdGFydHNXaXRofVwiYDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoXCJlbmRzV2l0aFwiIGluIGlzc3VlLnZhbGlkYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnZhbGlkIGlucHV0OiBtdXN0IGVuZCB3aXRoIFwiJHtpc3N1ZS52YWxpZGF0aW9uLmVuZHNXaXRofVwiYDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHV0aWwuYXNzZXJ0TmV2ZXIoaXNzdWUudmFsaWRhdGlvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudmFsaWRhdGlvbiAhPT0gXCJyZWdleFwiKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnZhbGlkICR7aXNzdWUudmFsaWRhdGlvbn1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwiSW52YWxpZFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLnRvb19zbWFsbDpcbiAgICAgICAgICAgIGlmIChpc3N1ZS50eXBlID09PSBcImFycmF5XCIpXG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBBcnJheSBtdXN0IGNvbnRhaW4gJHtpc3N1ZS5leGFjdCA/IFwiZXhhY3RseVwiIDogaXNzdWUuaW5jbHVzaXZlID8gYGF0IGxlYXN0YCA6IGBtb3JlIHRoYW5gfSAke2lzc3VlLm1pbmltdW19IGVsZW1lbnQocylgO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudHlwZSA9PT0gXCJzdHJpbmdcIilcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYFN0cmluZyBtdXN0IGNvbnRhaW4gJHtpc3N1ZS5leGFjdCA/IFwiZXhhY3RseVwiIDogaXNzdWUuaW5jbHVzaXZlID8gYGF0IGxlYXN0YCA6IGBvdmVyYH0gJHtpc3N1ZS5taW5pbXVtfSBjaGFyYWN0ZXIocylgO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudHlwZSA9PT0gXCJudW1iZXJcIilcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYE51bWJlciBtdXN0IGJlICR7aXNzdWUuZXhhY3QgPyBgZXhhY3RseSBlcXVhbCB0byBgIDogaXNzdWUuaW5jbHVzaXZlID8gYGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBgIDogYGdyZWF0ZXIgdGhhbiBgfSR7aXNzdWUubWluaW11bX1gO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudHlwZSA9PT0gXCJiaWdpbnRcIilcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYE51bWJlciBtdXN0IGJlICR7aXNzdWUuZXhhY3QgPyBgZXhhY3RseSBlcXVhbCB0byBgIDogaXNzdWUuaW5jbHVzaXZlID8gYGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBgIDogYGdyZWF0ZXIgdGhhbiBgfSR7aXNzdWUubWluaW11bX1gO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudHlwZSA9PT0gXCJkYXRlXCIpXG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBEYXRlIG11c3QgYmUgJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5IGVxdWFsIHRvIGAgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGAgOiBgZ3JlYXRlciB0aGFuIGB9JHtuZXcgRGF0ZShOdW1iZXIoaXNzdWUubWluaW11bSkpfWA7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwiSW52YWxpZCBpbnB1dFwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLnRvb19iaWc6XG4gICAgICAgICAgICBpZiAoaXNzdWUudHlwZSA9PT0gXCJhcnJheVwiKVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgQXJyYXkgbXVzdCBjb250YWluICR7aXNzdWUuZXhhY3QgPyBgZXhhY3RseWAgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgYXQgbW9zdGAgOiBgbGVzcyB0aGFuYH0gJHtpc3N1ZS5tYXhpbXVtfSBlbGVtZW50KHMpYDtcbiAgICAgICAgICAgIGVsc2UgaWYgKGlzc3VlLnR5cGUgPT09IFwic3RyaW5nXCIpXG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBTdHJpbmcgbXVzdCBjb250YWluICR7aXNzdWUuZXhhY3QgPyBgZXhhY3RseWAgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgYXQgbW9zdGAgOiBgdW5kZXJgfSAke2lzc3VlLm1heGltdW19IGNoYXJhY3RlcihzKWA7XG4gICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS50eXBlID09PSBcIm51bWJlclwiKVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgTnVtYmVyIG11c3QgYmUgJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5YCA6IGlzc3VlLmluY2x1c2l2ZSA/IGBsZXNzIHRoYW4gb3IgZXF1YWwgdG9gIDogYGxlc3MgdGhhbmB9ICR7aXNzdWUubWF4aW11bX1gO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudHlwZSA9PT0gXCJiaWdpbnRcIilcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYEJpZ0ludCBtdXN0IGJlICR7aXNzdWUuZXhhY3QgPyBgZXhhY3RseWAgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgbGVzcyB0aGFuIG9yIGVxdWFsIHRvYCA6IGBsZXNzIHRoYW5gfSAke2lzc3VlLm1heGltdW19YDtcbiAgICAgICAgICAgIGVsc2UgaWYgKGlzc3VlLnR5cGUgPT09IFwiZGF0ZVwiKVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgRGF0ZSBtdXN0IGJlICR7aXNzdWUuZXhhY3QgPyBgZXhhY3RseWAgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgc21hbGxlciB0aGFuIG9yIGVxdWFsIHRvYCA6IGBzbWFsbGVyIHRoYW5gfSAke25ldyBEYXRlKE51bWJlcihpc3N1ZS5tYXhpbXVtKSl9YDtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJJbnZhbGlkIGlucHV0XCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUuY3VzdG9tOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnZhbGlkIGlucHV0YDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5pbnZhbGlkX2ludGVyc2VjdGlvbl90eXBlczpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW50ZXJzZWN0aW9uIHJlc3VsdHMgY291bGQgbm90IGJlIG1lcmdlZGA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUubm90X211bHRpcGxlX29mOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBOdW1iZXIgbXVzdCBiZSBhIG11bHRpcGxlIG9mICR7aXNzdWUubXVsdGlwbGVPZn1gO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLm5vdF9maW5pdGU6XG4gICAgICAgICAgICBtZXNzYWdlID0gXCJOdW1iZXIgbXVzdCBiZSBmaW5pdGVcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgbWVzc2FnZSA9IF9jdHguZGVmYXVsdEVycm9yO1xuICAgICAgICAgICAgdXRpbC5hc3NlcnROZXZlcihpc3N1ZSk7XG4gICAgfVxuICAgIHJldHVybiB7IG1lc3NhZ2UgfTtcbn07XG5leHBvcnQgZGVmYXVsdCBlcnJvck1hcDtcbiIsICJpbXBvcnQgZGVmYXVsdEVycm9yTWFwIGZyb20gXCIuL2xvY2FsZXMvZW4uanNcIjtcbmxldCBvdmVycmlkZUVycm9yTWFwID0gZGVmYXVsdEVycm9yTWFwO1xuZXhwb3J0IHsgZGVmYXVsdEVycm9yTWFwIH07XG5leHBvcnQgZnVuY3Rpb24gc2V0RXJyb3JNYXAobWFwKSB7XG4gICAgb3ZlcnJpZGVFcnJvck1hcCA9IG1hcDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRFcnJvck1hcCgpIHtcbiAgICByZXR1cm4gb3ZlcnJpZGVFcnJvck1hcDtcbn1cbiIsICJpbXBvcnQgeyBnZXRFcnJvck1hcCB9IGZyb20gXCIuLi9lcnJvcnMuanNcIjtcbmltcG9ydCBkZWZhdWx0RXJyb3JNYXAgZnJvbSBcIi4uL2xvY2FsZXMvZW4uanNcIjtcbmV4cG9ydCBjb25zdCBtYWtlSXNzdWUgPSAocGFyYW1zKSA9PiB7XG4gICAgY29uc3QgeyBkYXRhLCBwYXRoLCBlcnJvck1hcHMsIGlzc3VlRGF0YSB9ID0gcGFyYW1zO1xuICAgIGNvbnN0IGZ1bGxQYXRoID0gWy4uLnBhdGgsIC4uLihpc3N1ZURhdGEucGF0aCB8fCBbXSldO1xuICAgIGNvbnN0IGZ1bGxJc3N1ZSA9IHtcbiAgICAgICAgLi4uaXNzdWVEYXRhLFxuICAgICAgICBwYXRoOiBmdWxsUGF0aCxcbiAgICB9O1xuICAgIGlmIChpc3N1ZURhdGEubWVzc2FnZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5pc3N1ZURhdGEsXG4gICAgICAgICAgICBwYXRoOiBmdWxsUGF0aCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGlzc3VlRGF0YS5tZXNzYWdlLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBsZXQgZXJyb3JNZXNzYWdlID0gXCJcIjtcbiAgICBjb25zdCBtYXBzID0gZXJyb3JNYXBzXG4gICAgICAgIC5maWx0ZXIoKG0pID0+ICEhbSlcbiAgICAgICAgLnNsaWNlKClcbiAgICAgICAgLnJldmVyc2UoKTtcbiAgICBmb3IgKGNvbnN0IG1hcCBvZiBtYXBzKSB7XG4gICAgICAgIGVycm9yTWVzc2FnZSA9IG1hcChmdWxsSXNzdWUsIHsgZGF0YSwgZGVmYXVsdEVycm9yOiBlcnJvck1lc3NhZ2UgfSkubWVzc2FnZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgLi4uaXNzdWVEYXRhLFxuICAgICAgICBwYXRoOiBmdWxsUGF0aCxcbiAgICAgICAgbWVzc2FnZTogZXJyb3JNZXNzYWdlLFxuICAgIH07XG59O1xuZXhwb3J0IGNvbnN0IEVNUFRZX1BBVEggPSBbXTtcbmV4cG9ydCBmdW5jdGlvbiBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIGlzc3VlRGF0YSkge1xuICAgIGNvbnN0IG92ZXJyaWRlTWFwID0gZ2V0RXJyb3JNYXAoKTtcbiAgICBjb25zdCBpc3N1ZSA9IG1ha2VJc3N1ZSh7XG4gICAgICAgIGlzc3VlRGF0YTogaXNzdWVEYXRhLFxuICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgIGVycm9yTWFwczogW1xuICAgICAgICAgICAgY3R4LmNvbW1vbi5jb250ZXh0dWFsRXJyb3JNYXAsIC8vIGNvbnRleHR1YWwgZXJyb3IgbWFwIGlzIGZpcnN0IHByaW9yaXR5XG4gICAgICAgICAgICBjdHguc2NoZW1hRXJyb3JNYXAsIC8vIHRoZW4gc2NoZW1hLWJvdW5kIG1hcCBpZiBhdmFpbGFibGVcbiAgICAgICAgICAgIG92ZXJyaWRlTWFwLCAvLyB0aGVuIGdsb2JhbCBvdmVycmlkZSBtYXBcbiAgICAgICAgICAgIG92ZXJyaWRlTWFwID09PSBkZWZhdWx0RXJyb3JNYXAgPyB1bmRlZmluZWQgOiBkZWZhdWx0RXJyb3JNYXAsIC8vIHRoZW4gZ2xvYmFsIGRlZmF1bHQgbWFwXG4gICAgICAgIF0uZmlsdGVyKCh4KSA9PiAhIXgpLFxuICAgIH0pO1xuICAgIGN0eC5jb21tb24uaXNzdWVzLnB1c2goaXNzdWUpO1xufVxuZXhwb3J0IGNsYXNzIFBhcnNlU3RhdHVzIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IFwidmFsaWRcIjtcbiAgICB9XG4gICAgZGlydHkoKSB7XG4gICAgICAgIGlmICh0aGlzLnZhbHVlID09PSBcInZhbGlkXCIpXG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gXCJkaXJ0eVwiO1xuICAgIH1cbiAgICBhYm9ydCgpIHtcbiAgICAgICAgaWYgKHRoaXMudmFsdWUgIT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IFwiYWJvcnRlZFwiO1xuICAgIH1cbiAgICBzdGF0aWMgbWVyZ2VBcnJheShzdGF0dXMsIHJlc3VsdHMpIHtcbiAgICAgICAgY29uc3QgYXJyYXlWYWx1ZSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHMgb2YgcmVzdWx0cykge1xuICAgICAgICAgICAgaWYgKHMuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgIGlmIChzLnN0YXR1cyA9PT0gXCJkaXJ0eVwiKVxuICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgYXJyYXlWYWx1ZS5wdXNoKHMudmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogYXJyYXlWYWx1ZSB9O1xuICAgIH1cbiAgICBzdGF0aWMgYXN5bmMgbWVyZ2VPYmplY3RBc3luYyhzdGF0dXMsIHBhaXJzKSB7XG4gICAgICAgIGNvbnN0IHN5bmNQYWlycyA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHBhaXIgb2YgcGFpcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGtleSA9IGF3YWl0IHBhaXIua2V5O1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCBwYWlyLnZhbHVlO1xuICAgICAgICAgICAgc3luY1BhaXJzLnB1c2goe1xuICAgICAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQYXJzZVN0YXR1cy5tZXJnZU9iamVjdFN5bmMoc3RhdHVzLCBzeW5jUGFpcnMpO1xuICAgIH1cbiAgICBzdGF0aWMgbWVyZ2VPYmplY3RTeW5jKHN0YXR1cywgcGFpcnMpIHtcbiAgICAgICAgY29uc3QgZmluYWxPYmplY3QgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBwYWlyIG9mIHBhaXJzKSB7XG4gICAgICAgICAgICBjb25zdCB7IGtleSwgdmFsdWUgfSA9IHBhaXI7XG4gICAgICAgICAgICBpZiAoa2V5LnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICBpZiAodmFsdWUuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgIGlmIChrZXkuc3RhdHVzID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICBpZiAodmFsdWUuc3RhdHVzID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICBpZiAoa2V5LnZhbHVlICE9PSBcIl9fcHJvdG9fX1wiICYmICh0eXBlb2YgdmFsdWUudmFsdWUgIT09IFwidW5kZWZpbmVkXCIgfHwgcGFpci5hbHdheXNTZXQpKSB7XG4gICAgICAgICAgICAgICAgZmluYWxPYmplY3Rba2V5LnZhbHVlXSA9IHZhbHVlLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogZmluYWxPYmplY3QgfTtcbiAgICB9XG59XG5leHBvcnQgY29uc3QgSU5WQUxJRCA9IE9iamVjdC5mcmVlemUoe1xuICAgIHN0YXR1czogXCJhYm9ydGVkXCIsXG59KTtcbmV4cG9ydCBjb25zdCBESVJUWSA9ICh2YWx1ZSkgPT4gKHsgc3RhdHVzOiBcImRpcnR5XCIsIHZhbHVlIH0pO1xuZXhwb3J0IGNvbnN0IE9LID0gKHZhbHVlKSA9PiAoeyBzdGF0dXM6IFwidmFsaWRcIiwgdmFsdWUgfSk7XG5leHBvcnQgY29uc3QgaXNBYm9ydGVkID0gKHgpID0+IHguc3RhdHVzID09PSBcImFib3J0ZWRcIjtcbmV4cG9ydCBjb25zdCBpc0RpcnR5ID0gKHgpID0+IHguc3RhdHVzID09PSBcImRpcnR5XCI7XG5leHBvcnQgY29uc3QgaXNWYWxpZCA9ICh4KSA9PiB4LnN0YXR1cyA9PT0gXCJ2YWxpZFwiO1xuZXhwb3J0IGNvbnN0IGlzQXN5bmMgPSAoeCkgPT4gdHlwZW9mIFByb21pc2UgIT09IFwidW5kZWZpbmVkXCIgJiYgeCBpbnN0YW5jZW9mIFByb21pc2U7XG4iLCAiZXhwb3J0IHZhciBlcnJvclV0aWw7XG4oZnVuY3Rpb24gKGVycm9yVXRpbCkge1xuICAgIGVycm9yVXRpbC5lcnJUb09iaiA9IChtZXNzYWdlKSA9PiB0eXBlb2YgbWVzc2FnZSA9PT0gXCJzdHJpbmdcIiA/IHsgbWVzc2FnZSB9IDogbWVzc2FnZSB8fCB7fTtcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludDpcbiAgICBlcnJvclV0aWwudG9TdHJpbmcgPSAobWVzc2FnZSkgPT4gdHlwZW9mIG1lc3NhZ2UgPT09IFwic3RyaW5nXCIgPyBtZXNzYWdlIDogbWVzc2FnZT8ubWVzc2FnZTtcbn0pKGVycm9yVXRpbCB8fCAoZXJyb3JVdGlsID0ge30pKTtcbiIsICJpbXBvcnQgeyBab2RFcnJvciwgWm9kSXNzdWVDb2RlLCB9IGZyb20gXCIuL1pvZEVycm9yLmpzXCI7XG5pbXBvcnQgeyBkZWZhdWx0RXJyb3JNYXAsIGdldEVycm9yTWFwIH0gZnJvbSBcIi4vZXJyb3JzLmpzXCI7XG5pbXBvcnQgeyBlcnJvclV0aWwgfSBmcm9tIFwiLi9oZWxwZXJzL2Vycm9yVXRpbC5qc1wiO1xuaW1wb3J0IHsgRElSVFksIElOVkFMSUQsIE9LLCBQYXJzZVN0YXR1cywgYWRkSXNzdWVUb0NvbnRleHQsIGlzQWJvcnRlZCwgaXNBc3luYywgaXNEaXJ0eSwgaXNWYWxpZCwgbWFrZUlzc3VlLCB9IGZyb20gXCIuL2hlbHBlcnMvcGFyc2VVdGlsLmpzXCI7XG5pbXBvcnQgeyB1dGlsLCBab2RQYXJzZWRUeXBlLCBnZXRQYXJzZWRUeXBlIH0gZnJvbSBcIi4vaGVscGVycy91dGlsLmpzXCI7XG5jbGFzcyBQYXJzZUlucHV0TGF6eVBhdGgge1xuICAgIGNvbnN0cnVjdG9yKHBhcmVudCwgdmFsdWUsIHBhdGgsIGtleSkge1xuICAgICAgICB0aGlzLl9jYWNoZWRQYXRoID0gW107XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmRhdGEgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fcGF0aCA9IHBhdGg7XG4gICAgICAgIHRoaXMuX2tleSA9IGtleTtcbiAgICB9XG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY2FjaGVkUGF0aC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRoaXMuX2tleSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZWRQYXRoLnB1c2goLi4udGhpcy5fcGF0aCwgLi4udGhpcy5fa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlZFBhdGgucHVzaCguLi50aGlzLl9wYXRoLCB0aGlzLl9rZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRQYXRoO1xuICAgIH1cbn1cbmNvbnN0IGhhbmRsZVJlc3VsdCA9IChjdHgsIHJlc3VsdCkgPT4ge1xuICAgIGlmIChpc1ZhbGlkKHJlc3VsdCkpIHtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcmVzdWx0LnZhbHVlIH07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoIWN0eC5jb21tb24uaXNzdWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVmFsaWRhdGlvbiBmYWlsZWQgYnV0IG5vIGlzc3VlcyBkZXRlY3RlZC5cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZ2V0IGVycm9yKCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9lcnJvcilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2Vycm9yO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFpvZEVycm9yKGN0eC5jb21tb24uaXNzdWVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9lcnJvciA9IGVycm9yO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9lcnJvcjtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgfVxufTtcbmZ1bmN0aW9uIHByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSB7XG4gICAgaWYgKCFwYXJhbXMpXG4gICAgICAgIHJldHVybiB7fTtcbiAgICBjb25zdCB7IGVycm9yTWFwLCBpbnZhbGlkX3R5cGVfZXJyb3IsIHJlcXVpcmVkX2Vycm9yLCBkZXNjcmlwdGlvbiB9ID0gcGFyYW1zO1xuICAgIGlmIChlcnJvck1hcCAmJiAoaW52YWxpZF90eXBlX2Vycm9yIHx8IHJlcXVpcmVkX2Vycm9yKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHVzZSBcImludmFsaWRfdHlwZV9lcnJvclwiIG9yIFwicmVxdWlyZWRfZXJyb3JcIiBpbiBjb25qdW5jdGlvbiB3aXRoIGN1c3RvbSBlcnJvciBtYXAuYCk7XG4gICAgfVxuICAgIGlmIChlcnJvck1hcClcbiAgICAgICAgcmV0dXJuIHsgZXJyb3JNYXA6IGVycm9yTWFwLCBkZXNjcmlwdGlvbiB9O1xuICAgIGNvbnN0IGN1c3RvbU1hcCA9IChpc3MsIGN0eCkgPT4ge1xuICAgICAgICBjb25zdCB7IG1lc3NhZ2UgfSA9IHBhcmFtcztcbiAgICAgICAgaWYgKGlzcy5jb2RlID09PSBcImludmFsaWRfZW51bV92YWx1ZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4geyBtZXNzYWdlOiBtZXNzYWdlID8/IGN0eC5kZWZhdWx0RXJyb3IgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGN0eC5kYXRhID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICByZXR1cm4geyBtZXNzYWdlOiBtZXNzYWdlID8/IHJlcXVpcmVkX2Vycm9yID8/IGN0eC5kZWZhdWx0RXJyb3IgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNzLmNvZGUgIT09IFwiaW52YWxpZF90eXBlXCIpXG4gICAgICAgICAgICByZXR1cm4geyBtZXNzYWdlOiBjdHguZGVmYXVsdEVycm9yIH07XG4gICAgICAgIHJldHVybiB7IG1lc3NhZ2U6IG1lc3NhZ2UgPz8gaW52YWxpZF90eXBlX2Vycm9yID8/IGN0eC5kZWZhdWx0RXJyb3IgfTtcbiAgICB9O1xuICAgIHJldHVybiB7IGVycm9yTWFwOiBjdXN0b21NYXAsIGRlc2NyaXB0aW9uIH07XG59XG5leHBvcnQgY2xhc3MgWm9kVHlwZSB7XG4gICAgZ2V0IGRlc2NyaXB0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmRlc2NyaXB0aW9uO1xuICAgIH1cbiAgICBfZ2V0VHlwZShpbnB1dCkge1xuICAgICAgICByZXR1cm4gZ2V0UGFyc2VkVHlwZShpbnB1dC5kYXRhKTtcbiAgICB9XG4gICAgX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIChjdHggfHwge1xuICAgICAgICAgICAgY29tbW9uOiBpbnB1dC5wYXJlbnQuY29tbW9uLFxuICAgICAgICAgICAgZGF0YTogaW5wdXQuZGF0YSxcbiAgICAgICAgICAgIHBhcnNlZFR5cGU6IGdldFBhcnNlZFR5cGUoaW5wdXQuZGF0YSksXG4gICAgICAgICAgICBzY2hlbWFFcnJvck1hcDogdGhpcy5fZGVmLmVycm9yTWFwLFxuICAgICAgICAgICAgcGF0aDogaW5wdXQucGF0aCxcbiAgICAgICAgICAgIHBhcmVudDogaW5wdXQucGFyZW50LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzOiBuZXcgUGFyc2VTdGF0dXMoKSxcbiAgICAgICAgICAgIGN0eDoge1xuICAgICAgICAgICAgICAgIGNvbW1vbjogaW5wdXQucGFyZW50LmNvbW1vbixcbiAgICAgICAgICAgICAgICBkYXRhOiBpbnB1dC5kYXRhLFxuICAgICAgICAgICAgICAgIHBhcnNlZFR5cGU6IGdldFBhcnNlZFR5cGUoaW5wdXQuZGF0YSksXG4gICAgICAgICAgICAgICAgc2NoZW1hRXJyb3JNYXA6IHRoaXMuX2RlZi5lcnJvck1hcCxcbiAgICAgICAgICAgICAgICBwYXRoOiBpbnB1dC5wYXRoLFxuICAgICAgICAgICAgICAgIHBhcmVudDogaW5wdXQucGFyZW50LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgX3BhcnNlU3luYyhpbnB1dCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9wYXJzZShpbnB1dCk7XG4gICAgICAgIGlmIChpc0FzeW5jKHJlc3VsdCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlN5bmNocm9ub3VzIHBhcnNlIGVuY291bnRlcmVkIHByb21pc2UuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIF9wYXJzZUFzeW5jKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3BhcnNlKGlucHV0KTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXN1bHQpO1xuICAgIH1cbiAgICBwYXJzZShkYXRhLCBwYXJhbXMpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5zYWZlUGFyc2UoZGF0YSwgcGFyYW1zKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5kYXRhO1xuICAgICAgICB0aHJvdyByZXN1bHQuZXJyb3I7XG4gICAgfVxuICAgIHNhZmVQYXJzZShkYXRhLCBwYXJhbXMpIHtcbiAgICAgICAgY29uc3QgY3R4ID0ge1xuICAgICAgICAgICAgY29tbW9uOiB7XG4gICAgICAgICAgICAgICAgaXNzdWVzOiBbXSxcbiAgICAgICAgICAgICAgICBhc3luYzogcGFyYW1zPy5hc3luYyA/PyBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb250ZXh0dWFsRXJyb3JNYXA6IHBhcmFtcz8uZXJyb3JNYXAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aDogcGFyYW1zPy5wYXRoIHx8IFtdLFxuICAgICAgICAgICAgc2NoZW1hRXJyb3JNYXA6IHRoaXMuX2RlZi5lcnJvck1hcCxcbiAgICAgICAgICAgIHBhcmVudDogbnVsbCxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXJzZWRUeXBlOiBnZXRQYXJzZWRUeXBlKGRhdGEpLFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9wYXJzZVN5bmMoeyBkYXRhLCBwYXRoOiBjdHgucGF0aCwgcGFyZW50OiBjdHggfSk7XG4gICAgICAgIHJldHVybiBoYW5kbGVSZXN1bHQoY3R4LCByZXN1bHQpO1xuICAgIH1cbiAgICBcIn52YWxpZGF0ZVwiKGRhdGEpIHtcbiAgICAgICAgY29uc3QgY3R4ID0ge1xuICAgICAgICAgICAgY29tbW9uOiB7XG4gICAgICAgICAgICAgICAgaXNzdWVzOiBbXSxcbiAgICAgICAgICAgICAgICBhc3luYzogISF0aGlzW1wifnN0YW5kYXJkXCJdLmFzeW5jLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdGg6IFtdLFxuICAgICAgICAgICAgc2NoZW1hRXJyb3JNYXA6IHRoaXMuX2RlZi5lcnJvck1hcCxcbiAgICAgICAgICAgIHBhcmVudDogbnVsbCxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXJzZWRUeXBlOiBnZXRQYXJzZWRUeXBlKGRhdGEpLFxuICAgICAgICB9O1xuICAgICAgICBpZiAoIXRoaXNbXCJ+c3RhbmRhcmRcIl0uYXN5bmMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcGFyc2VTeW5jKHsgZGF0YSwgcGF0aDogW10sIHBhcmVudDogY3R4IH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBpc1ZhbGlkKHJlc3VsdClcbiAgICAgICAgICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcmVzdWx0LnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNzdWVzOiBjdHguY29tbW9uLmlzc3VlcyxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyPy5tZXNzYWdlPy50b0xvd2VyQ2FzZSgpPy5pbmNsdWRlcyhcImVuY291bnRlcmVkXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbXCJ+c3RhbmRhcmRcIl0uYXN5bmMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdHguY29tbW9uID0ge1xuICAgICAgICAgICAgICAgICAgICBpc3N1ZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgICBhc3luYzogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXJzZUFzeW5jKHsgZGF0YSwgcGF0aDogW10sIHBhcmVudDogY3R4IH0pLnRoZW4oKHJlc3VsdCkgPT4gaXNWYWxpZChyZXN1bHQpXG4gICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogcmVzdWx0LnZhbHVlLFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgOiB7XG4gICAgICAgICAgICAgICAgaXNzdWVzOiBjdHguY29tbW9uLmlzc3VlcyxcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbiAgICBhc3luYyBwYXJzZUFzeW5jKGRhdGEsIHBhcmFtcykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnNhZmVQYXJzZUFzeW5jKGRhdGEsIHBhcmFtcyk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcylcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQuZGF0YTtcbiAgICAgICAgdGhyb3cgcmVzdWx0LmVycm9yO1xuICAgIH1cbiAgICBhc3luYyBzYWZlUGFyc2VBc3luYyhkYXRhLCBwYXJhbXMpIHtcbiAgICAgICAgY29uc3QgY3R4ID0ge1xuICAgICAgICAgICAgY29tbW9uOiB7XG4gICAgICAgICAgICAgICAgaXNzdWVzOiBbXSxcbiAgICAgICAgICAgICAgICBjb250ZXh0dWFsRXJyb3JNYXA6IHBhcmFtcz8uZXJyb3JNYXAsXG4gICAgICAgICAgICAgICAgYXN5bmM6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aDogcGFyYW1zPy5wYXRoIHx8IFtdLFxuICAgICAgICAgICAgc2NoZW1hRXJyb3JNYXA6IHRoaXMuX2RlZi5lcnJvck1hcCxcbiAgICAgICAgICAgIHBhcmVudDogbnVsbCxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXJzZWRUeXBlOiBnZXRQYXJzZWRUeXBlKGRhdGEpLFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBtYXliZUFzeW5jUmVzdWx0ID0gdGhpcy5fcGFyc2UoeyBkYXRhLCBwYXRoOiBjdHgucGF0aCwgcGFyZW50OiBjdHggfSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IChpc0FzeW5jKG1heWJlQXN5bmNSZXN1bHQpID8gbWF5YmVBc3luY1Jlc3VsdCA6IFByb21pc2UucmVzb2x2ZShtYXliZUFzeW5jUmVzdWx0KSk7XG4gICAgICAgIHJldHVybiBoYW5kbGVSZXN1bHQoY3R4LCByZXN1bHQpO1xuICAgIH1cbiAgICByZWZpbmUoY2hlY2ssIG1lc3NhZ2UpIHtcbiAgICAgICAgY29uc3QgZ2V0SXNzdWVQcm9wZXJ0aWVzID0gKHZhbCkgPT4ge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXNzYWdlID09PSBcInN0cmluZ1wiIHx8IHR5cGVvZiBtZXNzYWdlID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgbWVzc2FnZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIG1lc3NhZ2UgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBtZXNzYWdlKHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlZmluZW1lbnQoKHZhbCwgY3R4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBjaGVjayh2YWwpO1xuICAgICAgICAgICAgY29uc3Qgc2V0RXJyb3IgPSAoKSA9PiBjdHguYWRkSXNzdWUoe1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5jdXN0b20sXG4gICAgICAgICAgICAgICAgLi4uZ2V0SXNzdWVQcm9wZXJ0aWVzKHZhbCksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgUHJvbWlzZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiByZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0RXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHNldEVycm9yKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZWZpbmVtZW50KGNoZWNrLCByZWZpbmVtZW50RGF0YSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVmaW5lbWVudCgodmFsLCBjdHgpID0+IHtcbiAgICAgICAgICAgIGlmICghY2hlY2sodmFsKSkge1xuICAgICAgICAgICAgICAgIGN0eC5hZGRJc3N1ZSh0eXBlb2YgcmVmaW5lbWVudERhdGEgPT09IFwiZnVuY3Rpb25cIiA/IHJlZmluZW1lbnREYXRhKHZhbCwgY3R4KSA6IHJlZmluZW1lbnREYXRhKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIF9yZWZpbmVtZW50KHJlZmluZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RFZmZlY3RzKHtcbiAgICAgICAgICAgIHNjaGVtYTogdGhpcyxcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRWZmZWN0cyxcbiAgICAgICAgICAgIGVmZmVjdDogeyB0eXBlOiBcInJlZmluZW1lbnRcIiwgcmVmaW5lbWVudCB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgc3VwZXJSZWZpbmUocmVmaW5lbWVudCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVmaW5lbWVudChyZWZpbmVtZW50KTtcbiAgICB9XG4gICAgY29uc3RydWN0b3IoZGVmKSB7XG4gICAgICAgIC8qKiBBbGlhcyBvZiBzYWZlUGFyc2VBc3luYyAqL1xuICAgICAgICB0aGlzLnNwYSA9IHRoaXMuc2FmZVBhcnNlQXN5bmM7XG4gICAgICAgIHRoaXMuX2RlZiA9IGRlZjtcbiAgICAgICAgdGhpcy5wYXJzZSA9IHRoaXMucGFyc2UuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5zYWZlUGFyc2UgPSB0aGlzLnNhZmVQYXJzZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnBhcnNlQXN5bmMgPSB0aGlzLnBhcnNlQXN5bmMuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5zYWZlUGFyc2VBc3luYyA9IHRoaXMuc2FmZVBhcnNlQXN5bmMuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5zcGEgPSB0aGlzLnNwYS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnJlZmluZSA9IHRoaXMucmVmaW5lLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMucmVmaW5lbWVudCA9IHRoaXMucmVmaW5lbWVudC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnN1cGVyUmVmaW5lID0gdGhpcy5zdXBlclJlZmluZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLm9wdGlvbmFsID0gdGhpcy5vcHRpb25hbC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLm51bGxhYmxlID0gdGhpcy5udWxsYWJsZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLm51bGxpc2ggPSB0aGlzLm51bGxpc2guYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5hcnJheSA9IHRoaXMuYXJyYXkuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5wcm9taXNlID0gdGhpcy5wcm9taXNlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMub3IgPSB0aGlzLm9yLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuYW5kID0gdGhpcy5hbmQuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy50cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmJyYW5kID0gdGhpcy5icmFuZC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmRlZmF1bHQgPSB0aGlzLmRlZmF1bHQuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYXRjaCA9IHRoaXMuY2F0Y2guYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5kZXNjcmliZSA9IHRoaXMuZGVzY3JpYmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5waXBlID0gdGhpcy5waXBlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMucmVhZG9ubHkgPSB0aGlzLnJlYWRvbmx5LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuaXNOdWxsYWJsZSA9IHRoaXMuaXNOdWxsYWJsZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmlzT3B0aW9uYWwgPSB0aGlzLmlzT3B0aW9uYWwuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpc1tcIn5zdGFuZGFyZFwiXSA9IHtcbiAgICAgICAgICAgIHZlcnNpb246IDEsXG4gICAgICAgICAgICB2ZW5kb3I6IFwiem9kXCIsXG4gICAgICAgICAgICB2YWxpZGF0ZTogKGRhdGEpID0+IHRoaXNbXCJ+dmFsaWRhdGVcIl0oZGF0YSksXG4gICAgICAgIH07XG4gICAgfVxuICAgIG9wdGlvbmFsKCkge1xuICAgICAgICByZXR1cm4gWm9kT3B0aW9uYWwuY3JlYXRlKHRoaXMsIHRoaXMuX2RlZik7XG4gICAgfVxuICAgIG51bGxhYmxlKCkge1xuICAgICAgICByZXR1cm4gWm9kTnVsbGFibGUuY3JlYXRlKHRoaXMsIHRoaXMuX2RlZik7XG4gICAgfVxuICAgIG51bGxpc2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm51bGxhYmxlKCkub3B0aW9uYWwoKTtcbiAgICB9XG4gICAgYXJyYXkoKSB7XG4gICAgICAgIHJldHVybiBab2RBcnJheS5jcmVhdGUodGhpcyk7XG4gICAgfVxuICAgIHByb21pc2UoKSB7XG4gICAgICAgIHJldHVybiBab2RQcm9taXNlLmNyZWF0ZSh0aGlzLCB0aGlzLl9kZWYpO1xuICAgIH1cbiAgICBvcihvcHRpb24pIHtcbiAgICAgICAgcmV0dXJuIFpvZFVuaW9uLmNyZWF0ZShbdGhpcywgb3B0aW9uXSwgdGhpcy5fZGVmKTtcbiAgICB9XG4gICAgYW5kKGluY29taW5nKSB7XG4gICAgICAgIHJldHVybiBab2RJbnRlcnNlY3Rpb24uY3JlYXRlKHRoaXMsIGluY29taW5nLCB0aGlzLl9kZWYpO1xuICAgIH1cbiAgICB0cmFuc2Zvcm0odHJhbnNmb3JtKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kRWZmZWN0cyh7XG4gICAgICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHRoaXMuX2RlZiksXG4gICAgICAgICAgICBzY2hlbWE6IHRoaXMsXG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEVmZmVjdHMsXG4gICAgICAgICAgICBlZmZlY3Q6IHsgdHlwZTogXCJ0cmFuc2Zvcm1cIiwgdHJhbnNmb3JtIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBkZWZhdWx0KGRlZikge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWVGdW5jID0gdHlwZW9mIGRlZiA9PT0gXCJmdW5jdGlvblwiID8gZGVmIDogKCkgPT4gZGVmO1xuICAgICAgICByZXR1cm4gbmV3IFpvZERlZmF1bHQoe1xuICAgICAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyh0aGlzLl9kZWYpLFxuICAgICAgICAgICAgaW5uZXJUeXBlOiB0aGlzLFxuICAgICAgICAgICAgZGVmYXVsdFZhbHVlOiBkZWZhdWx0VmFsdWVGdW5jLFxuICAgICAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2REZWZhdWx0LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgYnJhbmQoKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kQnJhbmRlZCh7XG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEJyYW5kZWQsXG4gICAgICAgICAgICB0eXBlOiB0aGlzLFxuICAgICAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyh0aGlzLl9kZWYpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgY2F0Y2goZGVmKSB7XG4gICAgICAgIGNvbnN0IGNhdGNoVmFsdWVGdW5jID0gdHlwZW9mIGRlZiA9PT0gXCJmdW5jdGlvblwiID8gZGVmIDogKCkgPT4gZGVmO1xuICAgICAgICByZXR1cm4gbmV3IFpvZENhdGNoKHtcbiAgICAgICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXModGhpcy5fZGVmKSxcbiAgICAgICAgICAgIGlubmVyVHlwZTogdGhpcyxcbiAgICAgICAgICAgIGNhdGNoVmFsdWU6IGNhdGNoVmFsdWVGdW5jLFxuICAgICAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RDYXRjaCxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGRlc2NyaWJlKGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIGNvbnN0IFRoaXMgPSB0aGlzLmNvbnN0cnVjdG9yO1xuICAgICAgICByZXR1cm4gbmV3IFRoaXMoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBwaXBlKHRhcmdldCkge1xuICAgICAgICByZXR1cm4gWm9kUGlwZWxpbmUuY3JlYXRlKHRoaXMsIHRhcmdldCk7XG4gICAgfVxuICAgIHJlYWRvbmx5KCkge1xuICAgICAgICByZXR1cm4gWm9kUmVhZG9ubHkuY3JlYXRlKHRoaXMpO1xuICAgIH1cbiAgICBpc09wdGlvbmFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zYWZlUGFyc2UodW5kZWZpbmVkKS5zdWNjZXNzO1xuICAgIH1cbiAgICBpc051bGxhYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zYWZlUGFyc2UobnVsbCkuc3VjY2VzcztcbiAgICB9XG59XG5jb25zdCBjdWlkUmVnZXggPSAvXmNbXlxccy1dezgsfSQvaTtcbmNvbnN0IGN1aWQyUmVnZXggPSAvXlswLTlhLXpdKyQvO1xuY29uc3QgdWxpZFJlZ2V4ID0gL15bMC05QS1ISktNTlAtVFYtWl17MjZ9JC9pO1xuLy8gY29uc3QgdXVpZFJlZ2V4ID1cbi8vICAgL14oW2EtZjAtOV17OH0tW2EtZjAtOV17NH0tWzEtNV1bYS1mMC05XXszfS1bYS1mMC05XXs0fS1bYS1mMC05XXsxMn18MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwKSQvaTtcbmNvbnN0IHV1aWRSZWdleCA9IC9eWzAtOWEtZkEtRl17OH1cXGItWzAtOWEtZkEtRl17NH1cXGItWzAtOWEtZkEtRl17NH1cXGItWzAtOWEtZkEtRl17NH1cXGItWzAtOWEtZkEtRl17MTJ9JC9pO1xuY29uc3QgbmFub2lkUmVnZXggPSAvXlthLXowLTlfLV17MjF9JC9pO1xuY29uc3Qgand0UmVnZXggPSAvXltBLVphLXowLTktX10rXFwuW0EtWmEtejAtOS1fXStcXC5bQS1aYS16MC05LV9dKiQvO1xuY29uc3QgZHVyYXRpb25SZWdleCA9IC9eWy0rXT9QKD8hJCkoPzooPzpbLStdP1xcZCtZKXwoPzpbLStdP1xcZCtbLixdXFxkK1kkKSk/KD86KD86Wy0rXT9cXGQrTSl8KD86Wy0rXT9cXGQrWy4sXVxcZCtNJCkpPyg/Oig/OlstK10/XFxkK1cpfCg/OlstK10/XFxkK1suLF1cXGQrVyQpKT8oPzooPzpbLStdP1xcZCtEKXwoPzpbLStdP1xcZCtbLixdXFxkK0QkKSk/KD86VCg/PVtcXGQrLV0pKD86KD86Wy0rXT9cXGQrSCl8KD86Wy0rXT9cXGQrWy4sXVxcZCtIJCkpPyg/Oig/OlstK10/XFxkK00pfCg/OlstK10/XFxkK1suLF1cXGQrTSQpKT8oPzpbLStdP1xcZCsoPzpbLixdXFxkKyk/Uyk/KT8/JC87XG4vLyBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS80NjE4MS8xNTUwMTU1XG4vLyBvbGQgdmVyc2lvbjogdG9vIHNsb3csIGRpZG4ndCBzdXBwb3J0IHVuaWNvZGVcbi8vIGNvbnN0IGVtYWlsUmVnZXggPSAvXigoKFthLXpdfFxcZHxbISNcXCQlJidcXCpcXCtcXC1cXC89XFw/XFxeX2B7XFx8fX5dfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSsoXFwuKFthLXpdfFxcZHxbISNcXCQlJidcXCpcXCtcXC1cXC89XFw/XFxeX2B7XFx8fX5dfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSspKil8KChcXHgyMikoKCgoXFx4MjB8XFx4MDkpKihcXHgwZFxceDBhKSk/KFxceDIwfFxceDA5KSspPygoW1xceDAxLVxceDA4XFx4MGJcXHgwY1xceDBlLVxceDFmXFx4N2ZdfFxceDIxfFtcXHgyMy1cXHg1Yl18W1xceDVkLVxceDdlXXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KFxcXFwoW1xceDAxLVxceDA5XFx4MGJcXHgwY1xceDBkLVxceDdmXXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkpKSkqKCgoXFx4MjB8XFx4MDkpKihcXHgwZFxceDBhKSk/KFxceDIwfFxceDA5KSspPyhcXHgyMikpKUAoKChbYS16XXxcXGR8W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCgoW2Etel18XFxkfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKShbYS16XXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSooW2Etel18XFxkfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSkpXFwuKSsoKFthLXpdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoKFthLXpdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKShbYS16XXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSooW2Etel18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKSkkL2k7XG4vL29sZCBlbWFpbCByZWdleFxuLy8gY29uc3QgZW1haWxSZWdleCA9IC9eKChbXjw+KClbXFxdLiw7Olxcc0BcIl0rKFxcLltePD4oKVtcXF0uLDs6XFxzQFwiXSspKil8KFwiLitcIikpQCgoPyEtKShbXjw+KClbXFxdLiw7Olxcc0BcIl0rXFwuKStbXjw+KClbXFxdLiw7Olxcc0BcIl17MSx9KVteLTw+KClbXFxdLiw7Olxcc0BcIl0kL2k7XG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbi8vIGNvbnN0IGVtYWlsUmVnZXggPVxuLy8gICAvXigoW148PigpW1xcXVxcXFwuLDs6XFxzQFxcXCJdKyhcXC5bXjw+KClbXFxdXFxcXC4sOzpcXHNAXFxcIl0rKSopfChcXFwiLitcXFwiKSlAKChcXFsoKCgyNVswLTVdKXwoMlswLTRdWzAtOV0pfCgxWzAtOV17Mn0pfChbMC05XXsxLDJ9KSlcXC4pezN9KCgyNVswLTVdKXwoMlswLTRdWzAtOV0pfCgxWzAtOV17Mn0pfChbMC05XXsxLDJ9KSlcXF0pfChcXFtJUHY2OigoW2EtZjAtOV17MSw0fTopezd9fDo6KFthLWYwLTldezEsNH06KXswLDZ9fChbYS1mMC05XXsxLDR9Oil7MX06KFthLWYwLTldezEsNH06KXswLDV9fChbYS1mMC05XXsxLDR9Oil7Mn06KFthLWYwLTldezEsNH06KXswLDR9fChbYS1mMC05XXsxLDR9Oil7M306KFthLWYwLTldezEsNH06KXswLDN9fChbYS1mMC05XXsxLDR9Oil7NH06KFthLWYwLTldezEsNH06KXswLDJ9fChbYS1mMC05XXsxLDR9Oil7NX06KFthLWYwLTldezEsNH06KXswLDF9KShbYS1mMC05XXsxLDR9fCgoKDI1WzAtNV0pfCgyWzAtNF1bMC05XSl8KDFbMC05XXsyfSl8KFswLTldezEsMn0pKVxcLil7M30oKDI1WzAtNV0pfCgyWzAtNF1bMC05XSl8KDFbMC05XXsyfSl8KFswLTldezEsMn0pKSlcXF0pfChbQS1aYS16MC05XShbQS1aYS16MC05LV0qW0EtWmEtejAtOV0pKihcXC5bQS1aYS16XXsyLH0pKykpJC87XG4vLyBjb25zdCBlbWFpbFJlZ2V4ID1cbi8vICAgL15bYS16QS1aMC05XFwuXFwhXFwjXFwkXFwlXFwmXFwnXFwqXFwrXFwvXFw9XFw/XFxeXFxfXFxgXFx7XFx8XFx9XFx+XFwtXStAW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KD86XFwuW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KSokLztcbi8vIGNvbnN0IGVtYWlsUmVnZXggPVxuLy8gICAvXig/OlthLXowLTkhIyQlJicqKy89P15fYHt8fX4tXSsoPzpcXC5bYS16MC05ISMkJSYnKisvPT9eX2B7fH1+LV0rKSp8XCIoPzpbXFx4MDEtXFx4MDhcXHgwYlxceDBjXFx4MGUtXFx4MWZcXHgyMVxceDIzLVxceDViXFx4NWQtXFx4N2ZdfFxcXFxbXFx4MDEtXFx4MDlcXHgwYlxceDBjXFx4MGUtXFx4N2ZdKSpcIilAKD86KD86W2EtejAtOV0oPzpbYS16MC05LV0qW2EtejAtOV0pP1xcLikrW2EtejAtOV0oPzpbYS16MC05LV0qW2EtejAtOV0pP3xcXFsoPzooPzoyNVswLTVdfDJbMC00XVswLTldfFswMV0/WzAtOV1bMC05XT8pXFwuKXszfSg/OjI1WzAtNV18MlswLTRdWzAtOV18WzAxXT9bMC05XVswLTldP3xbYS16MC05LV0qW2EtejAtOV06KD86W1xceDAxLVxceDA4XFx4MGJcXHgwY1xceDBlLVxceDFmXFx4MjEtXFx4NWFcXHg1My1cXHg3Zl18XFxcXFtcXHgwMS1cXHgwOVxceDBiXFx4MGNcXHgwZS1cXHg3Zl0pKylcXF0pJC9pO1xuY29uc3QgZW1haWxSZWdleCA9IC9eKD8hXFwuKSg/IS4qXFwuXFwuKShbQS1aMC05XycrXFwtXFwuXSopW0EtWjAtOV8rLV1AKFtBLVowLTldW0EtWjAtOVxcLV0qXFwuKStbQS1aXXsyLH0kL2k7XG4vLyBjb25zdCBlbWFpbFJlZ2V4ID1cbi8vICAgL15bYS16MC05LiEjJCUmXHUyMDE5KisvPT9eX2B7fH1+LV0rQFthLXowLTktXSsoPzpcXC5bYS16MC05XFwtXSspKiQvaTtcbi8vIGZyb20gaHR0cHM6Ly90aGVrZXZpbnNjb3R0LmNvbS9lbW9qaXMtaW4tamF2YXNjcmlwdC8jd3JpdGluZy1hLXJlZ3VsYXItZXhwcmVzc2lvblxuY29uc3QgX2Vtb2ppUmVnZXggPSBgXihcXFxccHtFeHRlbmRlZF9QaWN0b2dyYXBoaWN9fFxcXFxwe0Vtb2ppX0NvbXBvbmVudH0pKyRgO1xubGV0IGVtb2ppUmVnZXg7XG4vLyBmYXN0ZXIsIHNpbXBsZXIsIHNhZmVyXG5jb25zdCBpcHY0UmVnZXggPSAvXig/Oig/OjI1WzAtNV18MlswLTRdWzAtOV18MVswLTldWzAtOV18WzEtOV1bMC05XXxbMC05XSlcXC4pezN9KD86MjVbMC01XXwyWzAtNF1bMC05XXwxWzAtOV1bMC05XXxbMS05XVswLTldfFswLTldKSQvO1xuY29uc3QgaXB2NENpZHJSZWdleCA9IC9eKD86KD86MjVbMC01XXwyWzAtNF1bMC05XXwxWzAtOV1bMC05XXxbMS05XVswLTldfFswLTldKVxcLil7M30oPzoyNVswLTVdfDJbMC00XVswLTldfDFbMC05XVswLTldfFsxLTldWzAtOV18WzAtOV0pXFwvKDNbMC0yXXxbMTJdP1swLTldKSQvO1xuLy8gY29uc3QgaXB2NlJlZ2V4ID1cbi8vIC9eKChbYS1mMC05XXsxLDR9Oil7N318OjooW2EtZjAtOV17MSw0fTopezAsNn18KFthLWYwLTldezEsNH06KXsxfTooW2EtZjAtOV17MSw0fTopezAsNX18KFthLWYwLTldezEsNH06KXsyfTooW2EtZjAtOV17MSw0fTopezAsNH18KFthLWYwLTldezEsNH06KXszfTooW2EtZjAtOV17MSw0fTopezAsM318KFthLWYwLTldezEsNH06KXs0fTooW2EtZjAtOV17MSw0fTopezAsMn18KFthLWYwLTldezEsNH06KXs1fTooW2EtZjAtOV17MSw0fTopezAsMX0pKFthLWYwLTldezEsNH18KCgoMjVbMC01XSl8KDJbMC00XVswLTldKXwoMVswLTldezJ9KXwoWzAtOV17MSwyfSkpXFwuKXszfSgoMjVbMC01XSl8KDJbMC00XVswLTldKXwoMVswLTldezJ9KXwoWzAtOV17MSwyfSkpKSQvO1xuY29uc3QgaXB2NlJlZ2V4ID0gL14oKFswLTlhLWZBLUZdezEsNH06KXs3LDd9WzAtOWEtZkEtRl17MSw0fXwoWzAtOWEtZkEtRl17MSw0fTopezEsN306fChbMC05YS1mQS1GXXsxLDR9Oil7MSw2fTpbMC05YS1mQS1GXXsxLDR9fChbMC05YS1mQS1GXXsxLDR9Oil7MSw1fSg6WzAtOWEtZkEtRl17MSw0fSl7MSwyfXwoWzAtOWEtZkEtRl17MSw0fTopezEsNH0oOlswLTlhLWZBLUZdezEsNH0pezEsM318KFswLTlhLWZBLUZdezEsNH06KXsxLDN9KDpbMC05YS1mQS1GXXsxLDR9KXsxLDR9fChbMC05YS1mQS1GXXsxLDR9Oil7MSwyfSg6WzAtOWEtZkEtRl17MSw0fSl7MSw1fXxbMC05YS1mQS1GXXsxLDR9OigoOlswLTlhLWZBLUZdezEsNH0pezEsNn0pfDooKDpbMC05YS1mQS1GXXsxLDR9KXsxLDd9fDopfGZlODA6KDpbMC05YS1mQS1GXXswLDR9KXswLDR9JVswLTlhLXpBLVpdezEsfXw6OihmZmZmKDowezEsNH0pezAsMX06KXswLDF9KCgyNVswLTVdfCgyWzAtNF18MXswLDF9WzAtOV0pezAsMX1bMC05XSlcXC4pezMsM30oMjVbMC01XXwoMlswLTRdfDF7MCwxfVswLTldKXswLDF9WzAtOV0pfChbMC05YS1mQS1GXXsxLDR9Oil7MSw0fTooKDI1WzAtNV18KDJbMC00XXwxezAsMX1bMC05XSl7MCwxfVswLTldKVxcLil7MywzfSgyNVswLTVdfCgyWzAtNF18MXswLDF9WzAtOV0pezAsMX1bMC05XSkpJC87XG5jb25zdCBpcHY2Q2lkclJlZ2V4ID0gL14oKFswLTlhLWZBLUZdezEsNH06KXs3LDd9WzAtOWEtZkEtRl17MSw0fXwoWzAtOWEtZkEtRl17MSw0fTopezEsN306fChbMC05YS1mQS1GXXsxLDR9Oil7MSw2fTpbMC05YS1mQS1GXXsxLDR9fChbMC05YS1mQS1GXXsxLDR9Oil7MSw1fSg6WzAtOWEtZkEtRl17MSw0fSl7MSwyfXwoWzAtOWEtZkEtRl17MSw0fTopezEsNH0oOlswLTlhLWZBLUZdezEsNH0pezEsM318KFswLTlhLWZBLUZdezEsNH06KXsxLDN9KDpbMC05YS1mQS1GXXsxLDR9KXsxLDR9fChbMC05YS1mQS1GXXsxLDR9Oil7MSwyfSg6WzAtOWEtZkEtRl17MSw0fSl7MSw1fXxbMC05YS1mQS1GXXsxLDR9OigoOlswLTlhLWZBLUZdezEsNH0pezEsNn0pfDooKDpbMC05YS1mQS1GXXsxLDR9KXsxLDd9fDopfGZlODA6KDpbMC05YS1mQS1GXXswLDR9KXswLDR9JVswLTlhLXpBLVpdezEsfXw6OihmZmZmKDowezEsNH0pezAsMX06KXswLDF9KCgyNVswLTVdfCgyWzAtNF18MXswLDF9WzAtOV0pezAsMX1bMC05XSlcXC4pezMsM30oMjVbMC01XXwoMlswLTRdfDF7MCwxfVswLTldKXswLDF9WzAtOV0pfChbMC05YS1mQS1GXXsxLDR9Oil7MSw0fTooKDI1WzAtNV18KDJbMC00XXwxezAsMX1bMC05XSl7MCwxfVswLTldKVxcLil7MywzfSgyNVswLTVdfCgyWzAtNF18MXswLDF9WzAtOV0pezAsMX1bMC05XSkpXFwvKDEyWzAtOF18MVswMV1bMC05XXxbMS05XT9bMC05XSkkLztcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzc4NjAzOTIvZGV0ZXJtaW5lLWlmLXN0cmluZy1pcy1pbi1iYXNlNjQtdXNpbmctamF2YXNjcmlwdFxuY29uc3QgYmFzZTY0UmVnZXggPSAvXihbMC05YS16QS1aKy9dezR9KSooKFswLTlhLXpBLVorL117Mn09PSl8KFswLTlhLXpBLVorL117M309KSk/JC87XG4vLyBodHRwczovL2Jhc2U2NC5ndXJ1L3N0YW5kYXJkcy9iYXNlNjR1cmxcbmNvbnN0IGJhc2U2NHVybFJlZ2V4ID0gL14oWzAtOWEtekEtWi1fXXs0fSkqKChbMC05YS16QS1aLV9dezJ9KD09KT8pfChbMC05YS16QS1aLV9dezN9KD0pPykpPyQvO1xuLy8gc2ltcGxlXG4vLyBjb25zdCBkYXRlUmVnZXhTb3VyY2UgPSBgXFxcXGR7NH0tXFxcXGR7Mn0tXFxcXGR7Mn1gO1xuLy8gbm8gbGVhcCB5ZWFyIHZhbGlkYXRpb25cbi8vIGNvbnN0IGRhdGVSZWdleFNvdXJjZSA9IGBcXFxcZHs0fS0oKDBbMTM1NzhdfDEwfDEyKS0zMXwoMFsxMy05XXwxWzAtMl0pLTMwfCgwWzEtOV18MVswLTJdKS0oMFsxLTldfDFcXFxcZHwyXFxcXGQpKWA7XG4vLyB3aXRoIGxlYXAgeWVhciB2YWxpZGF0aW9uXG5jb25zdCBkYXRlUmVnZXhTb3VyY2UgPSBgKChcXFxcZFxcXFxkWzI0NjhdWzA0OF18XFxcXGRcXFxcZFsxMzU3OV1bMjZdfFxcXFxkXFxcXGQwWzQ4XXxbMDI0NjhdWzA0OF0wMHxbMTM1NzldWzI2XTAwKS0wMi0yOXxcXFxcZHs0fS0oKDBbMTM1NzhdfDFbMDJdKS0oMFsxLTldfFsxMl1cXFxcZHwzWzAxXSl8KDBbNDY5XXwxMSktKDBbMS05XXxbMTJdXFxcXGR8MzApfCgwMiktKDBbMS05XXwxXFxcXGR8MlswLThdKSkpYDtcbmNvbnN0IGRhdGVSZWdleCA9IG5ldyBSZWdFeHAoYF4ke2RhdGVSZWdleFNvdXJjZX0kYCk7XG5mdW5jdGlvbiB0aW1lUmVnZXhTb3VyY2UoYXJncykge1xuICAgIGxldCBzZWNvbmRzUmVnZXhTb3VyY2UgPSBgWzAtNV1cXFxcZGA7XG4gICAgaWYgKGFyZ3MucHJlY2lzaW9uKSB7XG4gICAgICAgIHNlY29uZHNSZWdleFNvdXJjZSA9IGAke3NlY29uZHNSZWdleFNvdXJjZX1cXFxcLlxcXFxkeyR7YXJncy5wcmVjaXNpb259fWA7XG4gICAgfVxuICAgIGVsc2UgaWYgKGFyZ3MucHJlY2lzaW9uID09IG51bGwpIHtcbiAgICAgICAgc2Vjb25kc1JlZ2V4U291cmNlID0gYCR7c2Vjb25kc1JlZ2V4U291cmNlfShcXFxcLlxcXFxkKyk/YDtcbiAgICB9XG4gICAgY29uc3Qgc2Vjb25kc1F1YW50aWZpZXIgPSBhcmdzLnByZWNpc2lvbiA/IFwiK1wiIDogXCI/XCI7IC8vIHJlcXVpcmUgc2Vjb25kcyBpZiBwcmVjaXNpb24gaXMgbm9uemVyb1xuICAgIHJldHVybiBgKFswMV1cXFxcZHwyWzAtM10pOlswLTVdXFxcXGQoOiR7c2Vjb25kc1JlZ2V4U291cmNlfSkke3NlY29uZHNRdWFudGlmaWVyfWA7XG59XG5mdW5jdGlvbiB0aW1lUmVnZXgoYXJncykge1xuICAgIHJldHVybiBuZXcgUmVnRXhwKGBeJHt0aW1lUmVnZXhTb3VyY2UoYXJncyl9JGApO1xufVxuLy8gQWRhcHRlZCBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zMTQzMjMxXG5leHBvcnQgZnVuY3Rpb24gZGF0ZXRpbWVSZWdleChhcmdzKSB7XG4gICAgbGV0IHJlZ2V4ID0gYCR7ZGF0ZVJlZ2V4U291cmNlfVQke3RpbWVSZWdleFNvdXJjZShhcmdzKX1gO1xuICAgIGNvbnN0IG9wdHMgPSBbXTtcbiAgICBvcHRzLnB1c2goYXJncy5sb2NhbCA/IGBaP2AgOiBgWmApO1xuICAgIGlmIChhcmdzLm9mZnNldClcbiAgICAgICAgb3B0cy5wdXNoKGAoWystXVxcXFxkezJ9Oj9cXFxcZHsyfSlgKTtcbiAgICByZWdleCA9IGAke3JlZ2V4fSgke29wdHMuam9pbihcInxcIil9KWA7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoYF4ke3JlZ2V4fSRgKTtcbn1cbmZ1bmN0aW9uIGlzVmFsaWRJUChpcCwgdmVyc2lvbikge1xuICAgIGlmICgodmVyc2lvbiA9PT0gXCJ2NFwiIHx8ICF2ZXJzaW9uKSAmJiBpcHY0UmVnZXgudGVzdChpcCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmICgodmVyc2lvbiA9PT0gXCJ2NlwiIHx8ICF2ZXJzaW9uKSAmJiBpcHY2UmVnZXgudGVzdChpcCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cbmZ1bmN0aW9uIGlzVmFsaWRKV1Qoand0LCBhbGcpIHtcbiAgICBpZiAoIWp3dFJlZ2V4LnRlc3Qoand0KSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IFtoZWFkZXJdID0gand0LnNwbGl0KFwiLlwiKTtcbiAgICAgICAgaWYgKCFoZWFkZXIpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIC8vIENvbnZlcnQgYmFzZTY0dXJsIHRvIGJhc2U2NFxuICAgICAgICBjb25zdCBiYXNlNjQgPSBoZWFkZXJcbiAgICAgICAgICAgIC5yZXBsYWNlKC8tL2csIFwiK1wiKVxuICAgICAgICAgICAgLnJlcGxhY2UoL18vZywgXCIvXCIpXG4gICAgICAgICAgICAucGFkRW5kKGhlYWRlci5sZW5ndGggKyAoKDQgLSAoaGVhZGVyLmxlbmd0aCAlIDQpKSAlIDQpLCBcIj1cIik7XG4gICAgICAgIGNvbnN0IGRlY29kZWQgPSBKU09OLnBhcnNlKGF0b2IoYmFzZTY0KSk7XG4gICAgICAgIGlmICh0eXBlb2YgZGVjb2RlZCAhPT0gXCJvYmplY3RcIiB8fCBkZWNvZGVkID09PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoXCJ0eXBcIiBpbiBkZWNvZGVkICYmIGRlY29kZWQ/LnR5cCAhPT0gXCJKV1RcIilcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKCFkZWNvZGVkLmFsZylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGFsZyAmJiBkZWNvZGVkLmFsZyAhPT0gYWxnKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuZnVuY3Rpb24gaXNWYWxpZENpZHIoaXAsIHZlcnNpb24pIHtcbiAgICBpZiAoKHZlcnNpb24gPT09IFwidjRcIiB8fCAhdmVyc2lvbikgJiYgaXB2NENpZHJSZWdleC50ZXN0KGlwKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKCh2ZXJzaW9uID09PSBcInY2XCIgfHwgIXZlcnNpb24pICYmIGlwdjZDaWRyUmVnZXgudGVzdChpcCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cbmV4cG9ydCBjbGFzcyBab2RTdHJpbmcgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZi5jb2VyY2UpIHtcbiAgICAgICAgICAgIGlucHV0LmRhdGEgPSBTdHJpbmcoaW5wdXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyc2VkVHlwZSA9IHRoaXMuX2dldFR5cGUoaW5wdXQpO1xuICAgICAgICBpZiAocGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5zdHJpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUuc3RyaW5nLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhdHVzID0gbmV3IFBhcnNlU3RhdHVzKCk7XG4gICAgICAgIGxldCBjdHggPSB1bmRlZmluZWQ7XG4gICAgICAgIGZvciAoY29uc3QgY2hlY2sgb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoZWNrLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuZGF0YS5sZW5ndGggPCBjaGVjay52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX3NtYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWluaW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwibWF4XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuZGF0YS5sZW5ndGggPiBjaGVjay52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX2JpZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heGltdW06IGNoZWNrLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImxlbmd0aFwiKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vQmlnID0gaW5wdXQuZGF0YS5sZW5ndGggPiBjaGVjay52YWx1ZTtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29TbWFsbCA9IGlucHV0LmRhdGEubGVuZ3RoIDwgY2hlY2sudmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKHRvb0JpZyB8fCB0b29TbWFsbCkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvb0JpZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19iaWcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRvb1NtYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX3NtYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbmltdW06IGNoZWNrLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4YWN0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImVtYWlsXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVtYWlsUmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcImVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJlbW9qaVwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlbW9qaVJlZ2V4KSB7XG4gICAgICAgICAgICAgICAgICAgIGVtb2ppUmVnZXggPSBuZXcgUmVnRXhwKF9lbW9qaVJlZ2V4LCBcInVcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghZW1vamlSZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiZW1vamlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcInV1aWRcIikge1xuICAgICAgICAgICAgICAgIGlmICghdXVpZFJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJ1dWlkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJuYW5vaWRcIikge1xuICAgICAgICAgICAgICAgIGlmICghbmFub2lkUmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcIm5hbm9pZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiY3VpZFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjdWlkUmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcImN1aWRcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImN1aWQyXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWN1aWQyUmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcImN1aWQyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJ1bGlkXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXVsaWRSZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwidWxpZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwidXJsXCIpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBuZXcgVVJMKGlucHV0LmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwidXJsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJyZWdleFwiKSB7XG4gICAgICAgICAgICAgICAgY2hlY2sucmVnZXgubGFzdEluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXN0UmVzdWx0ID0gY2hlY2sucmVnZXgudGVzdChpbnB1dC5kYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRlc3RSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJyZWdleFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwidHJpbVwiKSB7XG4gICAgICAgICAgICAgICAgaW5wdXQuZGF0YSA9IGlucHV0LmRhdGEudHJpbSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJpbmNsdWRlc1wiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpbnB1dC5kYXRhLmluY2x1ZGVzKGNoZWNrLnZhbHVlLCBjaGVjay5wb3NpdGlvbikpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogeyBpbmNsdWRlczogY2hlY2sudmFsdWUsIHBvc2l0aW9uOiBjaGVjay5wb3NpdGlvbiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwidG9Mb3dlckNhc2VcIikge1xuICAgICAgICAgICAgICAgIGlucHV0LmRhdGEgPSBpbnB1dC5kYXRhLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcInRvVXBwZXJDYXNlXCIpIHtcbiAgICAgICAgICAgICAgICBpbnB1dC5kYXRhID0gaW5wdXQuZGF0YS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJzdGFydHNXaXRoXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlucHV0LmRhdGEuc3RhcnRzV2l0aChjaGVjay52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogeyBzdGFydHNXaXRoOiBjaGVjay52YWx1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiZW5kc1dpdGhcIikge1xuICAgICAgICAgICAgICAgIGlmICghaW5wdXQuZGF0YS5lbmRzV2l0aChjaGVjay52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogeyBlbmRzV2l0aDogY2hlY2sudmFsdWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImRhdGV0aW1lXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWdleCA9IGRhdGV0aW1lUmVnZXgoY2hlY2spO1xuICAgICAgICAgICAgICAgIGlmICghcmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcImRhdGV0aW1lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJkYXRlXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWdleCA9IGRhdGVSZWdleDtcbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJkYXRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJ0aW1lXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWdleCA9IHRpbWVSZWdleChjaGVjayk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwidGltZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiZHVyYXRpb25cIikge1xuICAgICAgICAgICAgICAgIGlmICghZHVyYXRpb25SZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiZHVyYXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImlwXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVmFsaWRJUChpbnB1dC5kYXRhLCBjaGVjay52ZXJzaW9uKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcImlwXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJqd3RcIikge1xuICAgICAgICAgICAgICAgIGlmICghaXNWYWxpZEpXVChpbnB1dC5kYXRhLCBjaGVjay5hbGcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiand0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJjaWRyXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVmFsaWRDaWRyKGlucHV0LmRhdGEsIGNoZWNrLnZlcnNpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiY2lkclwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiYmFzZTY0XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWJhc2U2NFJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJiYXNlNjRcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImJhc2U2NHVybFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFiYXNlNjR1cmxSZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiYmFzZTY0dXJsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXRpbC5hc3NlcnROZXZlcihjaGVjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiBzdGF0dXMudmFsdWUsIHZhbHVlOiBpbnB1dC5kYXRhIH07XG4gICAgfVxuICAgIF9yZWdleChyZWdleCwgdmFsaWRhdGlvbiwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZWZpbmVtZW50KChkYXRhKSA9PiByZWdleC50ZXN0KGRhdGEpLCB7XG4gICAgICAgICAgICB2YWxpZGF0aW9uLFxuICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgX2FkZENoZWNrKGNoZWNrKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kU3RyaW5nKHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGNoZWNrczogWy4uLnRoaXMuX2RlZi5jaGVja3MsIGNoZWNrXSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVtYWlsKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJlbWFpbFwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkgfSk7XG4gICAgfVxuICAgIHVybChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwidXJsXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgZW1vamkobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcImVtb2ppXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgdXVpZChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwidXVpZFwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkgfSk7XG4gICAgfVxuICAgIG5hbm9pZChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwibmFub2lkXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgY3VpZChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwiY3VpZFwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkgfSk7XG4gICAgfVxuICAgIGN1aWQyKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJjdWlkMlwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkgfSk7XG4gICAgfVxuICAgIHVsaWQobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcInVsaWRcIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpIH0pO1xuICAgIH1cbiAgICBiYXNlNjQobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcImJhc2U2NFwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkgfSk7XG4gICAgfVxuICAgIGJhc2U2NHVybChtZXNzYWdlKSB7XG4gICAgICAgIC8vIGJhc2U2NHVybCBlbmNvZGluZyBpcyBhIG1vZGlmaWNhdGlvbiBvZiBiYXNlNjQgdGhhdCBjYW4gc2FmZWx5IGJlIHVzZWQgaW4gVVJMcyBhbmQgZmlsZW5hbWVzXG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcImJhc2U2NHVybFwiLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgand0KG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJqd3RcIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG9wdGlvbnMpIH0pO1xuICAgIH1cbiAgICBpcChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwiaXBcIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG9wdGlvbnMpIH0pO1xuICAgIH1cbiAgICBjaWRyKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJjaWRyXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihvcHRpb25zKSB9KTtcbiAgICB9XG4gICAgZGF0ZXRpbWUob3B0aW9ucykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICAgICAga2luZDogXCJkYXRldGltZVwiLFxuICAgICAgICAgICAgICAgIHByZWNpc2lvbjogbnVsbCxcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGxvY2FsOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBvcHRpb25zLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwiZGF0ZXRpbWVcIixcbiAgICAgICAgICAgIHByZWNpc2lvbjogdHlwZW9mIG9wdGlvbnM/LnByZWNpc2lvbiA9PT0gXCJ1bmRlZmluZWRcIiA/IG51bGwgOiBvcHRpb25zPy5wcmVjaXNpb24sXG4gICAgICAgICAgICBvZmZzZXQ6IG9wdGlvbnM/Lm9mZnNldCA/PyBmYWxzZSxcbiAgICAgICAgICAgIGxvY2FsOiBvcHRpb25zPy5sb2NhbCA/PyBmYWxzZSxcbiAgICAgICAgICAgIC4uLmVycm9yVXRpbC5lcnJUb09iaihvcHRpb25zPy5tZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGRhdGUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcImRhdGVcIiwgbWVzc2FnZSB9KTtcbiAgICB9XG4gICAgdGltZShvcHRpb25zKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgICAgICBraW5kOiBcInRpbWVcIixcbiAgICAgICAgICAgICAgICBwcmVjaXNpb246IG51bGwsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogb3B0aW9ucyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcInRpbWVcIixcbiAgICAgICAgICAgIHByZWNpc2lvbjogdHlwZW9mIG9wdGlvbnM/LnByZWNpc2lvbiA9PT0gXCJ1bmRlZmluZWRcIiA/IG51bGwgOiBvcHRpb25zPy5wcmVjaXNpb24sXG4gICAgICAgICAgICAuLi5lcnJvclV0aWwuZXJyVG9PYmoob3B0aW9ucz8ubWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBkdXJhdGlvbihtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwiZHVyYXRpb25cIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpIH0pO1xuICAgIH1cbiAgICByZWdleChyZWdleCwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJyZWdleFwiLFxuICAgICAgICAgICAgcmVnZXg6IHJlZ2V4LFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgaW5jbHVkZXModmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwiaW5jbHVkZXNcIixcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIHBvc2l0aW9uOiBvcHRpb25zPy5wb3NpdGlvbixcbiAgICAgICAgICAgIC4uLmVycm9yVXRpbC5lcnJUb09iaihvcHRpb25zPy5tZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHN0YXJ0c1dpdGgodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwic3RhcnRzV2l0aFwiLFxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZW5kc1dpdGgodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwiZW5kc1dpdGhcIixcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG1pbihtaW5MZW5ndGgsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWluXCIsXG4gICAgICAgICAgICB2YWx1ZTogbWluTGVuZ3RoLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbWF4KG1heExlbmd0aCwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtYXhcIixcbiAgICAgICAgICAgIHZhbHVlOiBtYXhMZW5ndGgsXG4gICAgICAgICAgICAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsZW5ndGgobGVuLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcImxlbmd0aFwiLFxuICAgICAgICAgICAgdmFsdWU6IGxlbixcbiAgICAgICAgICAgIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEVxdWl2YWxlbnQgdG8gYC5taW4oMSlgXG4gICAgICovXG4gICAgbm9uZW1wdHkobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5taW4oMSwgZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpKTtcbiAgICB9XG4gICAgdHJpbSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RTdHJpbmcoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgY2hlY2tzOiBbLi4udGhpcy5fZGVmLmNoZWNrcywgeyBraW5kOiBcInRyaW1cIiB9XSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHRvTG93ZXJDYXNlKCkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZFN0cmluZyh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBjaGVja3M6IFsuLi50aGlzLl9kZWYuY2hlY2tzLCB7IGtpbmQ6IFwidG9Mb3dlckNhc2VcIiB9XSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHRvVXBwZXJDYXNlKCkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZFN0cmluZyh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBjaGVja3M6IFsuLi50aGlzLl9kZWYuY2hlY2tzLCB7IGtpbmQ6IFwidG9VcHBlckNhc2VcIiB9XSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGdldCBpc0RhdGV0aW1lKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImRhdGV0aW1lXCIpO1xuICAgIH1cbiAgICBnZXQgaXNEYXRlKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImRhdGVcIik7XG4gICAgfVxuICAgIGdldCBpc1RpbWUoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwidGltZVwiKTtcbiAgICB9XG4gICAgZ2V0IGlzRHVyYXRpb24oKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiZHVyYXRpb25cIik7XG4gICAgfVxuICAgIGdldCBpc0VtYWlsKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImVtYWlsXCIpO1xuICAgIH1cbiAgICBnZXQgaXNVUkwoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwidXJsXCIpO1xuICAgIH1cbiAgICBnZXQgaXNFbW9qaSgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJlbW9qaVwiKTtcbiAgICB9XG4gICAgZ2V0IGlzVVVJRCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJ1dWlkXCIpO1xuICAgIH1cbiAgICBnZXQgaXNOQU5PSUQoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwibmFub2lkXCIpO1xuICAgIH1cbiAgICBnZXQgaXNDVUlEKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImN1aWRcIik7XG4gICAgfVxuICAgIGdldCBpc0NVSUQyKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImN1aWQyXCIpO1xuICAgIH1cbiAgICBnZXQgaXNVTElEKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcInVsaWRcIik7XG4gICAgfVxuICAgIGdldCBpc0lQKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImlwXCIpO1xuICAgIH1cbiAgICBnZXQgaXNDSURSKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImNpZHJcIik7XG4gICAgfVxuICAgIGdldCBpc0Jhc2U2NCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJiYXNlNjRcIik7XG4gICAgfVxuICAgIGdldCBpc0Jhc2U2NHVybCgpIHtcbiAgICAgICAgLy8gYmFzZTY0dXJsIGVuY29kaW5nIGlzIGEgbW9kaWZpY2F0aW9uIG9mIGJhc2U2NCB0aGF0IGNhbiBzYWZlbHkgYmUgdXNlZCBpbiBVUkxzIGFuZCBmaWxlbmFtZXNcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJiYXNlNjR1cmxcIik7XG4gICAgfVxuICAgIGdldCBtaW5MZW5ndGgoKSB7XG4gICAgICAgIGxldCBtaW4gPSBudWxsO1xuICAgICAgICBmb3IgKGNvbnN0IGNoIG9mIHRoaXMuX2RlZi5jaGVja3MpIHtcbiAgICAgICAgICAgIGlmIChjaC5raW5kID09PSBcIm1pblwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1pbiA9PT0gbnVsbCB8fCBjaC52YWx1ZSA+IG1pbilcbiAgICAgICAgICAgICAgICAgICAgbWluID0gY2gudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1pbjtcbiAgICB9XG4gICAgZ2V0IG1heExlbmd0aCgpIHtcbiAgICAgICAgbGV0IG1heCA9IG51bGw7XG4gICAgICAgIGZvciAoY29uc3QgY2ggb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoLmtpbmQgPT09IFwibWF4XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWF4ID09PSBudWxsIHx8IGNoLnZhbHVlIDwgbWF4KVxuICAgICAgICAgICAgICAgICAgICBtYXggPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF4O1xuICAgIH1cbn1cblpvZFN0cmluZy5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RTdHJpbmcoe1xuICAgICAgICBjaGVja3M6IFtdLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZFN0cmluZyxcbiAgICAgICAgY29lcmNlOiBwYXJhbXM/LmNvZXJjZSA/PyBmYWxzZSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM5NjY0ODQvd2h5LWRvZXMtbW9kdWx1cy1vcGVyYXRvci1yZXR1cm4tZnJhY3Rpb25hbC1udW1iZXItaW4tamF2YXNjcmlwdC8zMTcxMTAzNCMzMTcxMTAzNFxuZnVuY3Rpb24gZmxvYXRTYWZlUmVtYWluZGVyKHZhbCwgc3RlcCkge1xuICAgIGNvbnN0IHZhbERlY0NvdW50ID0gKHZhbC50b1N0cmluZygpLnNwbGl0KFwiLlwiKVsxXSB8fCBcIlwiKS5sZW5ndGg7XG4gICAgY29uc3Qgc3RlcERlY0NvdW50ID0gKHN0ZXAudG9TdHJpbmcoKS5zcGxpdChcIi5cIilbMV0gfHwgXCJcIikubGVuZ3RoO1xuICAgIGNvbnN0IGRlY0NvdW50ID0gdmFsRGVjQ291bnQgPiBzdGVwRGVjQ291bnQgPyB2YWxEZWNDb3VudCA6IHN0ZXBEZWNDb3VudDtcbiAgICBjb25zdCB2YWxJbnQgPSBOdW1iZXIucGFyc2VJbnQodmFsLnRvRml4ZWQoZGVjQ291bnQpLnJlcGxhY2UoXCIuXCIsIFwiXCIpKTtcbiAgICBjb25zdCBzdGVwSW50ID0gTnVtYmVyLnBhcnNlSW50KHN0ZXAudG9GaXhlZChkZWNDb3VudCkucmVwbGFjZShcIi5cIiwgXCJcIikpO1xuICAgIHJldHVybiAodmFsSW50ICUgc3RlcEludCkgLyAxMCAqKiBkZWNDb3VudDtcbn1cbmV4cG9ydCBjbGFzcyBab2ROdW1iZXIgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5taW4gPSB0aGlzLmd0ZTtcbiAgICAgICAgdGhpcy5tYXggPSB0aGlzLmx0ZTtcbiAgICAgICAgdGhpcy5zdGVwID0gdGhpcy5tdWx0aXBsZU9mO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZi5jb2VyY2UpIHtcbiAgICAgICAgICAgIGlucHV0LmRhdGEgPSBOdW1iZXIoaW5wdXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyc2VkVHlwZSA9IHRoaXMuX2dldFR5cGUoaW5wdXQpO1xuICAgICAgICBpZiAocGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5udW1iZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUubnVtYmVyLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3Qgc3RhdHVzID0gbmV3IFBhcnNlU3RhdHVzKCk7XG4gICAgICAgIGZvciAoY29uc3QgY2hlY2sgb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoZWNrLmtpbmQgPT09IFwiaW50XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXV0aWwuaXNJbnRlZ2VyKGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZDogXCJpbnRlZ2VyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWNlaXZlZDogXCJmbG9hdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29TbWFsbCA9IGNoZWNrLmluY2x1c2l2ZSA/IGlucHV0LmRhdGEgPCBjaGVjay52YWx1ZSA6IGlucHV0LmRhdGEgPD0gY2hlY2sudmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKHRvb1NtYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fc21hbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiBjaGVjay52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwibnVtYmVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IGNoZWNrLmluY2x1c2l2ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcIm1heFwiKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vQmlnID0gY2hlY2suaW5jbHVzaXZlID8gaW5wdXQuZGF0YSA+IGNoZWNrLnZhbHVlIDogaW5wdXQuZGF0YSA+PSBjaGVjay52YWx1ZTtcbiAgICAgICAgICAgICAgICBpZiAodG9vQmlnKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fYmlnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIm51bWJlclwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVzaXZlOiBjaGVjay5pbmNsdXNpdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBleGFjdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJtdWx0aXBsZU9mXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmxvYXRTYWZlUmVtYWluZGVyKGlucHV0LmRhdGEsIGNoZWNrLnZhbHVlKSAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUubm90X211bHRpcGxlX29mLFxuICAgICAgICAgICAgICAgICAgICAgICAgbXVsdGlwbGVPZjogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJmaW5pdGVcIikge1xuICAgICAgICAgICAgICAgIGlmICghTnVtYmVyLmlzRmluaXRlKGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5ub3RfZmluaXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHV0aWwuYXNzZXJ0TmV2ZXIoY2hlY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogaW5wdXQuZGF0YSB9O1xuICAgIH1cbiAgICBndGUodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0TGltaXQoXCJtaW5cIiwgdmFsdWUsIHRydWUsIGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSk7XG4gICAgfVxuICAgIGd0KHZhbHVlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldExpbWl0KFwibWluXCIsIHZhbHVlLCBmYWxzZSwgZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpKTtcbiAgICB9XG4gICAgbHRlKHZhbHVlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldExpbWl0KFwibWF4XCIsIHZhbHVlLCB0cnVlLCBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkpO1xuICAgIH1cbiAgICBsdCh2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRMaW1pdChcIm1heFwiLCB2YWx1ZSwgZmFsc2UsIGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSk7XG4gICAgfVxuICAgIHNldExpbWl0KGtpbmQsIHZhbHVlLCBpbmNsdXNpdmUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2ROdW1iZXIoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgY2hlY2tzOiBbXG4gICAgICAgICAgICAgICAgLi4udGhpcy5fZGVmLmNoZWNrcyxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGtpbmQsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmUsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIF9hZGRDaGVjayhjaGVjaykge1xuICAgICAgICByZXR1cm4gbmV3IFpvZE51bWJlcih7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBjaGVja3M6IFsuLi50aGlzLl9kZWYuY2hlY2tzLCBjaGVja10sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBpbnQobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJpbnRcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHBvc2l0aXZlKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWluXCIsXG4gICAgICAgICAgICB2YWx1ZTogMCxcbiAgICAgICAgICAgIGluY2x1c2l2ZTogZmFsc2UsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBuZWdhdGl2ZShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm1heFwiLFxuICAgICAgICAgICAgdmFsdWU6IDAsXG4gICAgICAgICAgICBpbmNsdXNpdmU6IGZhbHNlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbm9ucG9zaXRpdmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtYXhcIixcbiAgICAgICAgICAgIHZhbHVlOiAwLFxuICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbm9ubmVnYXRpdmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtaW5cIixcbiAgICAgICAgICAgIHZhbHVlOiAwLFxuICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbXVsdGlwbGVPZih2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtdWx0aXBsZU9mXCIsXG4gICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBmaW5pdGUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJmaW5pdGVcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHNhZmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtaW5cIixcbiAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiBOdW1iZXIuTUlOX1NBRkVfSU5URUdFUixcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSkuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWF4XCIsXG4gICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBnZXQgbWluVmFsdWUoKSB7XG4gICAgICAgIGxldCBtaW4gPSBudWxsO1xuICAgICAgICBmb3IgKGNvbnN0IGNoIG9mIHRoaXMuX2RlZi5jaGVja3MpIHtcbiAgICAgICAgICAgIGlmIChjaC5raW5kID09PSBcIm1pblwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1pbiA9PT0gbnVsbCB8fCBjaC52YWx1ZSA+IG1pbilcbiAgICAgICAgICAgICAgICAgICAgbWluID0gY2gudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1pbjtcbiAgICB9XG4gICAgZ2V0IG1heFZhbHVlKCkge1xuICAgICAgICBsZXQgbWF4ID0gbnVsbDtcbiAgICAgICAgZm9yIChjb25zdCBjaCBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2gua2luZCA9PT0gXCJtYXhcIikge1xuICAgICAgICAgICAgICAgIGlmIChtYXggPT09IG51bGwgfHwgY2gudmFsdWUgPCBtYXgpXG4gICAgICAgICAgICAgICAgICAgIG1heCA9IGNoLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXg7XG4gICAgfVxuICAgIGdldCBpc0ludCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJpbnRcIiB8fCAoY2gua2luZCA9PT0gXCJtdWx0aXBsZU9mXCIgJiYgdXRpbC5pc0ludGVnZXIoY2gudmFsdWUpKSk7XG4gICAgfVxuICAgIGdldCBpc0Zpbml0ZSgpIHtcbiAgICAgICAgbGV0IG1heCA9IG51bGw7XG4gICAgICAgIGxldCBtaW4gPSBudWxsO1xuICAgICAgICBmb3IgKGNvbnN0IGNoIG9mIHRoaXMuX2RlZi5jaGVja3MpIHtcbiAgICAgICAgICAgIGlmIChjaC5raW5kID09PSBcImZpbml0ZVwiIHx8IGNoLmtpbmQgPT09IFwiaW50XCIgfHwgY2gua2luZCA9PT0gXCJtdWx0aXBsZU9mXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWluID09PSBudWxsIHx8IGNoLnZhbHVlID4gbWluKVxuICAgICAgICAgICAgICAgICAgICBtaW4gPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoLmtpbmQgPT09IFwibWF4XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWF4ID09PSBudWxsIHx8IGNoLnZhbHVlIDwgbWF4KVxuICAgICAgICAgICAgICAgICAgICBtYXggPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKG1pbikgJiYgTnVtYmVyLmlzRmluaXRlKG1heCk7XG4gICAgfVxufVxuWm9kTnVtYmVyLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZE51bWJlcih7XG4gICAgICAgIGNoZWNrczogW10sXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kTnVtYmVyLFxuICAgICAgICBjb2VyY2U6IHBhcmFtcz8uY29lcmNlIHx8IGZhbHNlLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZEJpZ0ludCBleHRlbmRzIFpvZFR5cGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLm1pbiA9IHRoaXMuZ3RlO1xuICAgICAgICB0aGlzLm1heCA9IHRoaXMubHRlO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZi5jb2VyY2UpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaW5wdXQuZGF0YSA9IEJpZ0ludChpbnB1dC5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0SW52YWxpZElucHV0KGlucHV0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLmJpZ2ludCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldEludmFsaWRJbnB1dChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3Qgc3RhdHVzID0gbmV3IFBhcnNlU3RhdHVzKCk7XG4gICAgICAgIGZvciAoY29uc3QgY2hlY2sgb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoZWNrLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29TbWFsbCA9IGNoZWNrLmluY2x1c2l2ZSA/IGlucHV0LmRhdGEgPCBjaGVjay52YWx1ZSA6IGlucHV0LmRhdGEgPD0gY2hlY2sudmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKHRvb1NtYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fc21hbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImJpZ2ludFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWluaW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IGNoZWNrLmluY2x1c2l2ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcIm1heFwiKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vQmlnID0gY2hlY2suaW5jbHVzaXZlID8gaW5wdXQuZGF0YSA+IGNoZWNrLnZhbHVlIDogaW5wdXQuZGF0YSA+PSBjaGVjay52YWx1ZTtcbiAgICAgICAgICAgICAgICBpZiAodG9vQmlnKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fYmlnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJiaWdpbnRcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heGltdW06IGNoZWNrLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVzaXZlOiBjaGVjay5pbmNsdXNpdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJtdWx0aXBsZU9mXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuZGF0YSAlIGNoZWNrLnZhbHVlICE9PSBCaWdJbnQoMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLm5vdF9tdWx0aXBsZV9vZixcbiAgICAgICAgICAgICAgICAgICAgICAgIG11bHRpcGxlT2Y6IGNoZWNrLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHV0aWwuYXNzZXJ0TmV2ZXIoY2hlY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogaW5wdXQuZGF0YSB9O1xuICAgIH1cbiAgICBfZ2V0SW52YWxpZElucHV0KGlucHV0KSB7XG4gICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUuYmlnaW50LFxuICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgfVxuICAgIGd0ZSh2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRMaW1pdChcIm1pblwiLCB2YWx1ZSwgdHJ1ZSwgZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpKTtcbiAgICB9XG4gICAgZ3QodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0TGltaXQoXCJtaW5cIiwgdmFsdWUsIGZhbHNlLCBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkpO1xuICAgIH1cbiAgICBsdGUodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0TGltaXQoXCJtYXhcIiwgdmFsdWUsIHRydWUsIGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSk7XG4gICAgfVxuICAgIGx0KHZhbHVlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldExpbWl0KFwibWF4XCIsIHZhbHVlLCBmYWxzZSwgZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpKTtcbiAgICB9XG4gICAgc2V0TGltaXQoa2luZCwgdmFsdWUsIGluY2x1c2l2ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZEJpZ0ludCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBjaGVja3M6IFtcbiAgICAgICAgICAgICAgICAuLi50aGlzLl9kZWYuY2hlY2tzLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAga2luZCxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgX2FkZENoZWNrKGNoZWNrKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kQmlnSW50KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGNoZWNrczogWy4uLnRoaXMuX2RlZi5jaGVja3MsIGNoZWNrXSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHBvc2l0aXZlKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWluXCIsXG4gICAgICAgICAgICB2YWx1ZTogQmlnSW50KDApLFxuICAgICAgICAgICAgaW5jbHVzaXZlOiBmYWxzZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG5lZ2F0aXZlKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWF4XCIsXG4gICAgICAgICAgICB2YWx1ZTogQmlnSW50KDApLFxuICAgICAgICAgICAgaW5jbHVzaXZlOiBmYWxzZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG5vbnBvc2l0aXZlKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWF4XCIsXG4gICAgICAgICAgICB2YWx1ZTogQmlnSW50KDApLFxuICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbm9ubmVnYXRpdmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtaW5cIixcbiAgICAgICAgICAgIHZhbHVlOiBCaWdJbnQoMCksXG4gICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBtdWx0aXBsZU9mKHZhbHVlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm11bHRpcGxlT2ZcIixcbiAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZ2V0IG1pblZhbHVlKCkge1xuICAgICAgICBsZXQgbWluID0gbnVsbDtcbiAgICAgICAgZm9yIChjb25zdCBjaCBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2gua2luZCA9PT0gXCJtaW5cIikge1xuICAgICAgICAgICAgICAgIGlmIChtaW4gPT09IG51bGwgfHwgY2gudmFsdWUgPiBtaW4pXG4gICAgICAgICAgICAgICAgICAgIG1pbiA9IGNoLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtaW47XG4gICAgfVxuICAgIGdldCBtYXhWYWx1ZSgpIHtcbiAgICAgICAgbGV0IG1heCA9IG51bGw7XG4gICAgICAgIGZvciAoY29uc3QgY2ggb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoLmtpbmQgPT09IFwibWF4XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWF4ID09PSBudWxsIHx8IGNoLnZhbHVlIDwgbWF4KVxuICAgICAgICAgICAgICAgICAgICBtYXggPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF4O1xuICAgIH1cbn1cblpvZEJpZ0ludC5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RCaWdJbnQoe1xuICAgICAgICBjaGVja3M6IFtdLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEJpZ0ludCxcbiAgICAgICAgY29lcmNlOiBwYXJhbXM/LmNvZXJjZSA/PyBmYWxzZSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2RCb29sZWFuIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGlmICh0aGlzLl9kZWYuY29lcmNlKSB7XG4gICAgICAgICAgICBpbnB1dC5kYXRhID0gQm9vbGVhbihpbnB1dC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLmJvb2xlYW4pIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUuYm9vbGVhbixcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBPSyhpbnB1dC5kYXRhKTtcbiAgICB9XG59XG5ab2RCb29sZWFuLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZEJvb2xlYW4oe1xuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEJvb2xlYW4sXG4gICAgICAgIGNvZXJjZTogcGFyYW1zPy5jb2VyY2UgfHwgZmFsc2UsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kRGF0ZSBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBpZiAodGhpcy5fZGVmLmNvZXJjZSkge1xuICAgICAgICAgICAgaW5wdXQuZGF0YSA9IG5ldyBEYXRlKGlucHV0LmRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUuZGF0ZSkge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5kYXRlLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKE51bWJlci5pc05hTihpbnB1dC5kYXRhLmdldFRpbWUoKSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX2RhdGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YXR1cyA9IG5ldyBQYXJzZVN0YXR1cygpO1xuICAgICAgICBsZXQgY3R4ID0gdW5kZWZpbmVkO1xuICAgICAgICBmb3IgKGNvbnN0IGNoZWNrIG9mIHRoaXMuX2RlZi5jaGVja3MpIHtcbiAgICAgICAgICAgIGlmIChjaGVjay5raW5kID09PSBcIm1pblwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LmRhdGEuZ2V0VGltZSgpIDwgY2hlY2sudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19zbWFsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBleGFjdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiBjaGVjay52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiZGF0ZVwiLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJtYXhcIikge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5kYXRhLmdldFRpbWUoKSA+IGNoZWNrLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fYmlnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heGltdW06IGNoZWNrLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJkYXRlXCIsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1dGlsLmFzc2VydE5ldmVyKGNoZWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXMudmFsdWUsXG4gICAgICAgICAgICB2YWx1ZTogbmV3IERhdGUoaW5wdXQuZGF0YS5nZXRUaW1lKCkpLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBfYWRkQ2hlY2soY2hlY2spIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2REYXRlKHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGNoZWNrczogWy4uLnRoaXMuX2RlZi5jaGVja3MsIGNoZWNrXSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG1pbihtaW5EYXRlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm1pblwiLFxuICAgICAgICAgICAgdmFsdWU6IG1pbkRhdGUuZ2V0VGltZSgpLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbWF4KG1heERhdGUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWF4XCIsXG4gICAgICAgICAgICB2YWx1ZTogbWF4RGF0ZS5nZXRUaW1lKCksXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBnZXQgbWluRGF0ZSgpIHtcbiAgICAgICAgbGV0IG1pbiA9IG51bGw7XG4gICAgICAgIGZvciAoY29uc3QgY2ggb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWluID09PSBudWxsIHx8IGNoLnZhbHVlID4gbWluKVxuICAgICAgICAgICAgICAgICAgICBtaW4gPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWluICE9IG51bGwgPyBuZXcgRGF0ZShtaW4pIDogbnVsbDtcbiAgICB9XG4gICAgZ2V0IG1heERhdGUoKSB7XG4gICAgICAgIGxldCBtYXggPSBudWxsO1xuICAgICAgICBmb3IgKGNvbnN0IGNoIG9mIHRoaXMuX2RlZi5jaGVja3MpIHtcbiAgICAgICAgICAgIGlmIChjaC5raW5kID09PSBcIm1heFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1heCA9PT0gbnVsbCB8fCBjaC52YWx1ZSA8IG1heClcbiAgICAgICAgICAgICAgICAgICAgbWF4ID0gY2gudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1heCAhPSBudWxsID8gbmV3IERhdGUobWF4KSA6IG51bGw7XG4gICAgfVxufVxuWm9kRGF0ZS5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2REYXRlKHtcbiAgICAgICAgY2hlY2tzOiBbXSxcbiAgICAgICAgY29lcmNlOiBwYXJhbXM/LmNvZXJjZSB8fCBmYWxzZSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2REYXRlLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZFN5bWJvbCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLnN5bWJvbCkge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5zeW1ib2wsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gT0soaW5wdXQuZGF0YSk7XG4gICAgfVxufVxuWm9kU3ltYm9sLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFN5bWJvbCh7XG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kU3ltYm9sLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZFVuZGVmaW5lZCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLnVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS51bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gT0soaW5wdXQuZGF0YSk7XG4gICAgfVxufVxuWm9kVW5kZWZpbmVkLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFVuZGVmaW5lZCh7XG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kVW5kZWZpbmVkLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZE51bGwgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkVHlwZSA9IHRoaXMuX2dldFR5cGUoaW5wdXQpO1xuICAgICAgICBpZiAocGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5udWxsKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLm51bGwsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gT0soaW5wdXQuZGF0YSk7XG4gICAgfVxufVxuWm9kTnVsbC5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2ROdWxsKHtcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2ROdWxsLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZEFueSBleHRlbmRzIFpvZFR5cGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICAvLyB0byBwcmV2ZW50IGluc3RhbmNlcyBvZiBvdGhlciBjbGFzc2VzIGZyb20gZXh0ZW5kaW5nIFpvZEFueS4gdGhpcyBjYXVzZXMgaXNzdWVzIHdpdGggY2F0Y2hhbGwgaW4gWm9kT2JqZWN0LlxuICAgICAgICB0aGlzLl9hbnkgPSB0cnVlO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIE9LKGlucHV0LmRhdGEpO1xuICAgIH1cbn1cblpvZEFueS5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RBbnkoe1xuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEFueSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2RVbmtub3duIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIC8vIHJlcXVpcmVkXG4gICAgICAgIHRoaXMuX3Vua25vd24gPSB0cnVlO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIE9LKGlucHV0LmRhdGEpO1xuICAgIH1cbn1cblpvZFVua25vd24uY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kVW5rbm93bih7XG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kVW5rbm93bixcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2ROZXZlciBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLm5ldmVyLFxuICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgfVxufVxuWm9kTmV2ZXIuY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kTmV2ZXIoe1xuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE5ldmVyLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZFZvaWQgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkVHlwZSA9IHRoaXMuX2dldFR5cGUoaW5wdXQpO1xuICAgICAgICBpZiAocGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS51bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUudm9pZCxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBPSyhpbnB1dC5kYXRhKTtcbiAgICB9XG59XG5ab2RWb2lkLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFZvaWQoe1xuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZFZvaWQsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kQXJyYXkgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBjdHgsIHN0YXR1cyB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgY29uc3QgZGVmID0gdGhpcy5fZGVmO1xuICAgICAgICBpZiAoY3R4LnBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUuYXJyYXkpIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUuYXJyYXksXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVmLmV4YWN0TGVuZ3RoICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCB0b29CaWcgPSBjdHguZGF0YS5sZW5ndGggPiBkZWYuZXhhY3RMZW5ndGgudmFsdWU7XG4gICAgICAgICAgICBjb25zdCB0b29TbWFsbCA9IGN0eC5kYXRhLmxlbmd0aCA8IGRlZi5leGFjdExlbmd0aC52YWx1ZTtcbiAgICAgICAgICAgIGlmICh0b29CaWcgfHwgdG9vU21hbGwpIHtcbiAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogdG9vQmlnID8gWm9kSXNzdWVDb2RlLnRvb19iaWcgOiBab2RJc3N1ZUNvZGUudG9vX3NtYWxsLFxuICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiAodG9vU21hbGwgPyBkZWYuZXhhY3RMZW5ndGgudmFsdWUgOiB1bmRlZmluZWQpLFxuICAgICAgICAgICAgICAgICAgICBtYXhpbXVtOiAodG9vQmlnID8gZGVmLmV4YWN0TGVuZ3RoLnZhbHVlIDogdW5kZWZpbmVkKSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGV4YWN0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBkZWYuZXhhY3RMZW5ndGgubWVzc2FnZSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVmLm1pbkxlbmd0aCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGN0eC5kYXRhLmxlbmd0aCA8IGRlZi5taW5MZW5ndGgudmFsdWUpIHtcbiAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19zbWFsbCxcbiAgICAgICAgICAgICAgICAgICAgbWluaW11bTogZGVmLm1pbkxlbmd0aC52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZGVmLm1pbkxlbmd0aC5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkZWYubWF4TGVuZ3RoICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoY3R4LmRhdGEubGVuZ3RoID4gZGVmLm1heExlbmd0aC52YWx1ZSkge1xuICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX2JpZyxcbiAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogZGVmLm1heExlbmd0aC52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZGVmLm1heExlbmd0aC5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoWy4uLmN0eC5kYXRhXS5tYXAoKGl0ZW0sIGkpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmLnR5cGUuX3BhcnNlQXN5bmMobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIGl0ZW0sIGN0eC5wYXRoLCBpKSk7XG4gICAgICAgICAgICB9KSkudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlQXJyYXkoc3RhdHVzLCByZXN1bHQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gWy4uLmN0eC5kYXRhXS5tYXAoKGl0ZW0sIGkpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBkZWYudHlwZS5fcGFyc2VTeW5jKG5ldyBQYXJzZUlucHV0TGF6eVBhdGgoY3R4LCBpdGVtLCBjdHgucGF0aCwgaSkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlQXJyYXkoc3RhdHVzLCByZXN1bHQpO1xuICAgIH1cbiAgICBnZXQgZWxlbWVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi50eXBlO1xuICAgIH1cbiAgICBtaW4obWluTGVuZ3RoLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kQXJyYXkoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgbWluTGVuZ3RoOiB7IHZhbHVlOiBtaW5MZW5ndGgsIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbWF4KG1heExlbmd0aCwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZEFycmF5KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIG1heExlbmd0aDogeyB2YWx1ZTogbWF4TGVuZ3RoLCBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxlbmd0aChsZW4sIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RBcnJheSh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBleGFjdExlbmd0aDogeyB2YWx1ZTogbGVuLCBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG5vbmVtcHR5KG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWluKDEsIG1lc3NhZ2UpO1xuICAgIH1cbn1cblpvZEFycmF5LmNyZWF0ZSA9IChzY2hlbWEsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kQXJyYXkoe1xuICAgICAgICB0eXBlOiBzY2hlbWEsXG4gICAgICAgIG1pbkxlbmd0aDogbnVsbCxcbiAgICAgICAgbWF4TGVuZ3RoOiBudWxsLFxuICAgICAgICBleGFjdExlbmd0aDogbnVsbCxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RBcnJheSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmZ1bmN0aW9uIGRlZXBQYXJ0aWFsaWZ5KHNjaGVtYSkge1xuICAgIGlmIChzY2hlbWEgaW5zdGFuY2VvZiBab2RPYmplY3QpIHtcbiAgICAgICAgY29uc3QgbmV3U2hhcGUgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2NoZW1hLnNoYXBlKSB7XG4gICAgICAgICAgICBjb25zdCBmaWVsZFNjaGVtYSA9IHNjaGVtYS5zaGFwZVtrZXldO1xuICAgICAgICAgICAgbmV3U2hhcGVba2V5XSA9IFpvZE9wdGlvbmFsLmNyZWF0ZShkZWVwUGFydGlhbGlmeShmaWVsZFNjaGVtYSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnNjaGVtYS5fZGVmLFxuICAgICAgICAgICAgc2hhcGU6ICgpID0+IG5ld1NoYXBlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSBpZiAoc2NoZW1hIGluc3RhbmNlb2YgWm9kQXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RBcnJheSh7XG4gICAgICAgICAgICAuLi5zY2hlbWEuX2RlZixcbiAgICAgICAgICAgIHR5cGU6IGRlZXBQYXJ0aWFsaWZ5KHNjaGVtYS5lbGVtZW50KSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHNjaGVtYSBpbnN0YW5jZW9mIFpvZE9wdGlvbmFsKSB7XG4gICAgICAgIHJldHVybiBab2RPcHRpb25hbC5jcmVhdGUoZGVlcFBhcnRpYWxpZnkoc2NoZW1hLnVud3JhcCgpKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHNjaGVtYSBpbnN0YW5jZW9mIFpvZE51bGxhYmxlKSB7XG4gICAgICAgIHJldHVybiBab2ROdWxsYWJsZS5jcmVhdGUoZGVlcFBhcnRpYWxpZnkoc2NoZW1hLnVud3JhcCgpKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHNjaGVtYSBpbnN0YW5jZW9mIFpvZFR1cGxlKSB7XG4gICAgICAgIHJldHVybiBab2RUdXBsZS5jcmVhdGUoc2NoZW1hLml0ZW1zLm1hcCgoaXRlbSkgPT4gZGVlcFBhcnRpYWxpZnkoaXRlbSkpKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBzY2hlbWE7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFpvZE9iamVjdCBleHRlbmRzIFpvZFR5cGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLl9jYWNoZWQgPSBudWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQGRlcHJlY2F0ZWQgSW4gbW9zdCBjYXNlcywgdGhpcyBpcyBubyBsb25nZXIgbmVlZGVkIC0gdW5rbm93biBwcm9wZXJ0aWVzIGFyZSBub3cgc2lsZW50bHkgc3RyaXBwZWQuXG4gICAgICAgICAqIElmIHlvdSB3YW50IHRvIHBhc3MgdGhyb3VnaCB1bmtub3duIHByb3BlcnRpZXMsIHVzZSBgLnBhc3N0aHJvdWdoKClgIGluc3RlYWQuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vbnN0cmljdCA9IHRoaXMucGFzc3Rocm91Z2g7XG4gICAgICAgIC8vIGV4dGVuZDxcbiAgICAgICAgLy8gICBBdWdtZW50YXRpb24gZXh0ZW5kcyBab2RSYXdTaGFwZSxcbiAgICAgICAgLy8gICBOZXdPdXRwdXQgZXh0ZW5kcyB1dGlsLmZsYXR0ZW48e1xuICAgICAgICAvLyAgICAgW2sgaW4ga2V5b2YgQXVnbWVudGF0aW9uIHwga2V5b2YgT3V0cHV0XTogayBleHRlbmRzIGtleW9mIEF1Z21lbnRhdGlvblxuICAgICAgICAvLyAgICAgICA/IEF1Z21lbnRhdGlvbltrXVtcIl9vdXRwdXRcIl1cbiAgICAgICAgLy8gICAgICAgOiBrIGV4dGVuZHMga2V5b2YgT3V0cHV0XG4gICAgICAgIC8vICAgICAgID8gT3V0cHV0W2tdXG4gICAgICAgIC8vICAgICAgIDogbmV2ZXI7XG4gICAgICAgIC8vICAgfT4sXG4gICAgICAgIC8vICAgTmV3SW5wdXQgZXh0ZW5kcyB1dGlsLmZsYXR0ZW48e1xuICAgICAgICAvLyAgICAgW2sgaW4ga2V5b2YgQXVnbWVudGF0aW9uIHwga2V5b2YgSW5wdXRdOiBrIGV4dGVuZHMga2V5b2YgQXVnbWVudGF0aW9uXG4gICAgICAgIC8vICAgICAgID8gQXVnbWVudGF0aW9uW2tdW1wiX2lucHV0XCJdXG4gICAgICAgIC8vICAgICAgIDogayBleHRlbmRzIGtleW9mIElucHV0XG4gICAgICAgIC8vICAgICAgID8gSW5wdXRba11cbiAgICAgICAgLy8gICAgICAgOiBuZXZlcjtcbiAgICAgICAgLy8gICB9PlxuICAgICAgICAvLyA+KFxuICAgICAgICAvLyAgIGF1Z21lbnRhdGlvbjogQXVnbWVudGF0aW9uXG4gICAgICAgIC8vICk6IFpvZE9iamVjdDxcbiAgICAgICAgLy8gICBleHRlbmRTaGFwZTxULCBBdWdtZW50YXRpb24+LFxuICAgICAgICAvLyAgIFVua25vd25LZXlzLFxuICAgICAgICAvLyAgIENhdGNoYWxsLFxuICAgICAgICAvLyAgIE5ld091dHB1dCxcbiAgICAgICAgLy8gICBOZXdJbnB1dFxuICAgICAgICAvLyA+IHtcbiAgICAgICAgLy8gICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgIC8vICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgIC8vICAgICBzaGFwZTogKCkgPT4gKHtcbiAgICAgICAgLy8gICAgICAgLi4udGhpcy5fZGVmLnNoYXBlKCksXG4gICAgICAgIC8vICAgICAgIC4uLmF1Z21lbnRhdGlvbixcbiAgICAgICAgLy8gICAgIH0pLFxuICAgICAgICAvLyAgIH0pIGFzIGFueTtcbiAgICAgICAgLy8gfVxuICAgICAgICAvKipcbiAgICAgICAgICogQGRlcHJlY2F0ZWQgVXNlIGAuZXh0ZW5kYCBpbnN0ZWFkXG4gICAgICAgICAqICAqL1xuICAgICAgICB0aGlzLmF1Z21lbnQgPSB0aGlzLmV4dGVuZDtcbiAgICB9XG4gICAgX2dldENhY2hlZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NhY2hlZCAhPT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jYWNoZWQ7XG4gICAgICAgIGNvbnN0IHNoYXBlID0gdGhpcy5fZGVmLnNoYXBlKCk7XG4gICAgICAgIGNvbnN0IGtleXMgPSB1dGlsLm9iamVjdEtleXMoc2hhcGUpO1xuICAgICAgICB0aGlzLl9jYWNoZWQgPSB7IHNoYXBlLCBrZXlzIH07XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZWQ7XG4gICAgfVxuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLm9iamVjdCkge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5vYmplY3QsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB7IHN0YXR1cywgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBjb25zdCB7IHNoYXBlLCBrZXlzOiBzaGFwZUtleXMgfSA9IHRoaXMuX2dldENhY2hlZCgpO1xuICAgICAgICBjb25zdCBleHRyYUtleXMgPSBbXTtcbiAgICAgICAgaWYgKCEodGhpcy5fZGVmLmNhdGNoYWxsIGluc3RhbmNlb2YgWm9kTmV2ZXIgJiYgdGhpcy5fZGVmLnVua25vd25LZXlzID09PSBcInN0cmlwXCIpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBjdHguZGF0YSkge1xuICAgICAgICAgICAgICAgIGlmICghc2hhcGVLZXlzLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXh0cmFLZXlzLnB1c2goa2V5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFpcnMgPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2Ygc2hhcGVLZXlzKSB7XG4gICAgICAgICAgICBjb25zdCBrZXlWYWxpZGF0b3IgPSBzaGFwZVtrZXldO1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBjdHguZGF0YVtrZXldO1xuICAgICAgICAgICAgcGFpcnMucHVzaCh7XG4gICAgICAgICAgICAgICAga2V5OiB7IHN0YXR1czogXCJ2YWxpZFwiLCB2YWx1ZToga2V5IH0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IGtleVZhbGlkYXRvci5fcGFyc2UobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIHZhbHVlLCBjdHgucGF0aCwga2V5KSksXG4gICAgICAgICAgICAgICAgYWx3YXlzU2V0OiBrZXkgaW4gY3R4LmRhdGEsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZGVmLmNhdGNoYWxsIGluc3RhbmNlb2YgWm9kTmV2ZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHVua25vd25LZXlzID0gdGhpcy5fZGVmLnVua25vd25LZXlzO1xuICAgICAgICAgICAgaWYgKHVua25vd25LZXlzID09PSBcInBhc3N0aHJvdWdoXCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBleHRyYUtleXMpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFpcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk6IHsgc3RhdHVzOiBcInZhbGlkXCIsIHZhbHVlOiBrZXkgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7IHN0YXR1czogXCJ2YWxpZFwiLCB2YWx1ZTogY3R4LmRhdGFba2V5XSB9LFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh1bmtub3duS2V5cyA9PT0gXCJzdHJpY3RcIikge1xuICAgICAgICAgICAgICAgIGlmIChleHRyYUtleXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS51bnJlY29nbml6ZWRfa2V5cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXM6IGV4dHJhS2V5cyxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHVua25vd25LZXlzID09PSBcInN0cmlwXCIpIHtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgWm9kT2JqZWN0IGVycm9yOiBpbnZhbGlkIHVua25vd25LZXlzIHZhbHVlLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gcnVuIGNhdGNoYWxsIHZhbGlkYXRpb25cbiAgICAgICAgICAgIGNvbnN0IGNhdGNoYWxsID0gdGhpcy5fZGVmLmNhdGNoYWxsO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgZXh0cmFLZXlzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBjdHguZGF0YVtrZXldO1xuICAgICAgICAgICAgICAgIHBhaXJzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBrZXk6IHsgc3RhdHVzOiBcInZhbGlkXCIsIHZhbHVlOiBrZXkgfSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGNhdGNoYWxsLl9wYXJzZShuZXcgUGFyc2VJbnB1dExhenlQYXRoKGN0eCwgdmFsdWUsIGN0eC5wYXRoLCBrZXkpIC8vLCBjdHguY2hpbGQoa2V5KSwgdmFsdWUsIGdldFBhcnNlZFR5cGUodmFsdWUpXG4gICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgIGFsd2F5c1NldDoga2V5IGluIGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICAgICAgICAudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3luY1BhaXJzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwYWlyIG9mIHBhaXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IGF3YWl0IHBhaXIua2V5O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHBhaXIudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIHN5bmNQYWlycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWx3YXlzU2V0OiBwYWlyLmFsd2F5c1NldCxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBzeW5jUGFpcnM7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKChzeW5jUGFpcnMpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUGFyc2VTdGF0dXMubWVyZ2VPYmplY3RTeW5jKHN0YXR1cywgc3luY1BhaXJzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlT2JqZWN0U3luYyhzdGF0dXMsIHBhaXJzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBnZXQgc2hhcGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuc2hhcGUoKTtcbiAgICB9XG4gICAgc3RyaWN0KG1lc3NhZ2UpIHtcbiAgICAgICAgZXJyb3JVdGlsLmVyclRvT2JqO1xuICAgICAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICB1bmtub3duS2V5czogXCJzdHJpY3RcIixcbiAgICAgICAgICAgIC4uLihtZXNzYWdlICE9PSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JNYXA6IChpc3N1ZSwgY3R4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWZhdWx0RXJyb3IgPSB0aGlzLl9kZWYuZXJyb3JNYXA/Lihpc3N1ZSwgY3R4KS5tZXNzYWdlID8/IGN0eC5kZWZhdWx0RXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNzdWUuY29kZSA9PT0gXCJ1bnJlY29nbml6ZWRfa2V5c1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKS5tZXNzYWdlID8/IGRlZmF1bHRFcnJvcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBkZWZhdWx0RXJyb3IsXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICA6IHt9KSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHN0cmlwKCkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICB1bmtub3duS2V5czogXCJzdHJpcFwiLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcGFzc3Rocm91Z2goKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHVua25vd25LZXlzOiBcInBhc3N0aHJvdWdoXCIsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBjb25zdCBBdWdtZW50RmFjdG9yeSA9XG4gICAgLy8gICA8RGVmIGV4dGVuZHMgWm9kT2JqZWN0RGVmPihkZWY6IERlZikgPT5cbiAgICAvLyAgIDxBdWdtZW50YXRpb24gZXh0ZW5kcyBab2RSYXdTaGFwZT4oXG4gICAgLy8gICAgIGF1Z21lbnRhdGlvbjogQXVnbWVudGF0aW9uXG4gICAgLy8gICApOiBab2RPYmplY3Q8XG4gICAgLy8gICAgIGV4dGVuZFNoYXBlPFJldHVyblR5cGU8RGVmW1wic2hhcGVcIl0+LCBBdWdtZW50YXRpb24+LFxuICAgIC8vICAgICBEZWZbXCJ1bmtub3duS2V5c1wiXSxcbiAgICAvLyAgICAgRGVmW1wiY2F0Y2hhbGxcIl1cbiAgICAvLyAgID4gPT4ge1xuICAgIC8vICAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgLy8gICAgICAgLi4uZGVmLFxuICAgIC8vICAgICAgIHNoYXBlOiAoKSA9PiAoe1xuICAgIC8vICAgICAgICAgLi4uZGVmLnNoYXBlKCksXG4gICAgLy8gICAgICAgICAuLi5hdWdtZW50YXRpb24sXG4gICAgLy8gICAgICAgfSksXG4gICAgLy8gICAgIH0pIGFzIGFueTtcbiAgICAvLyAgIH07XG4gICAgZXh0ZW5kKGF1Z21lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBzaGFwZTogKCkgPT4gKHtcbiAgICAgICAgICAgICAgICAuLi50aGlzLl9kZWYuc2hhcGUoKSxcbiAgICAgICAgICAgICAgICAuLi5hdWdtZW50YXRpb24sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFByaW9yIHRvIHpvZEAxLjAuMTIgdGhlcmUgd2FzIGEgYnVnIGluIHRoZVxuICAgICAqIGluZmVycmVkIHR5cGUgb2YgbWVyZ2VkIG9iamVjdHMuIFBsZWFzZVxuICAgICAqIHVwZ3JhZGUgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgaXNzdWVzLlxuICAgICAqL1xuICAgIG1lcmdlKG1lcmdpbmcpIHtcbiAgICAgICAgY29uc3QgbWVyZ2VkID0gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgICAgICB1bmtub3duS2V5czogbWVyZ2luZy5fZGVmLnVua25vd25LZXlzLFxuICAgICAgICAgICAgY2F0Y2hhbGw6IG1lcmdpbmcuX2RlZi5jYXRjaGFsbCxcbiAgICAgICAgICAgIHNoYXBlOiAoKSA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLnRoaXMuX2RlZi5zaGFwZSgpLFxuICAgICAgICAgICAgICAgIC4uLm1lcmdpbmcuX2RlZi5zaGFwZSgpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE9iamVjdCxcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBtZXJnZWQ7XG4gICAgfVxuICAgIC8vIG1lcmdlPFxuICAgIC8vICAgSW5jb21pbmcgZXh0ZW5kcyBBbnlab2RPYmplY3QsXG4gICAgLy8gICBBdWdtZW50YXRpb24gZXh0ZW5kcyBJbmNvbWluZ1tcInNoYXBlXCJdLFxuICAgIC8vICAgTmV3T3V0cHV0IGV4dGVuZHMge1xuICAgIC8vICAgICBbayBpbiBrZXlvZiBBdWdtZW50YXRpb24gfCBrZXlvZiBPdXRwdXRdOiBrIGV4dGVuZHMga2V5b2YgQXVnbWVudGF0aW9uXG4gICAgLy8gICAgICAgPyBBdWdtZW50YXRpb25ba11bXCJfb3V0cHV0XCJdXG4gICAgLy8gICAgICAgOiBrIGV4dGVuZHMga2V5b2YgT3V0cHV0XG4gICAgLy8gICAgICAgPyBPdXRwdXRba11cbiAgICAvLyAgICAgICA6IG5ldmVyO1xuICAgIC8vICAgfSxcbiAgICAvLyAgIE5ld0lucHV0IGV4dGVuZHMge1xuICAgIC8vICAgICBbayBpbiBrZXlvZiBBdWdtZW50YXRpb24gfCBrZXlvZiBJbnB1dF06IGsgZXh0ZW5kcyBrZXlvZiBBdWdtZW50YXRpb25cbiAgICAvLyAgICAgICA/IEF1Z21lbnRhdGlvbltrXVtcIl9pbnB1dFwiXVxuICAgIC8vICAgICAgIDogayBleHRlbmRzIGtleW9mIElucHV0XG4gICAgLy8gICAgICAgPyBJbnB1dFtrXVxuICAgIC8vICAgICAgIDogbmV2ZXI7XG4gICAgLy8gICB9XG4gICAgLy8gPihcbiAgICAvLyAgIG1lcmdpbmc6IEluY29taW5nXG4gICAgLy8gKTogWm9kT2JqZWN0PFxuICAgIC8vICAgZXh0ZW5kU2hhcGU8VCwgUmV0dXJuVHlwZTxJbmNvbWluZ1tcIl9kZWZcIl1bXCJzaGFwZVwiXT4+LFxuICAgIC8vICAgSW5jb21pbmdbXCJfZGVmXCJdW1widW5rbm93bktleXNcIl0sXG4gICAgLy8gICBJbmNvbWluZ1tcIl9kZWZcIl1bXCJjYXRjaGFsbFwiXSxcbiAgICAvLyAgIE5ld091dHB1dCxcbiAgICAvLyAgIE5ld0lucHV0XG4gICAgLy8gPiB7XG4gICAgLy8gICBjb25zdCBtZXJnZWQ6IGFueSA9IG5ldyBab2RPYmplY3Qoe1xuICAgIC8vICAgICB1bmtub3duS2V5czogbWVyZ2luZy5fZGVmLnVua25vd25LZXlzLFxuICAgIC8vICAgICBjYXRjaGFsbDogbWVyZ2luZy5fZGVmLmNhdGNoYWxsLFxuICAgIC8vICAgICBzaGFwZTogKCkgPT5cbiAgICAvLyAgICAgICBvYmplY3RVdGlsLm1lcmdlU2hhcGVzKHRoaXMuX2RlZi5zaGFwZSgpLCBtZXJnaW5nLl9kZWYuc2hhcGUoKSksXG4gICAgLy8gICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kT2JqZWN0LFxuICAgIC8vICAgfSkgYXMgYW55O1xuICAgIC8vICAgcmV0dXJuIG1lcmdlZDtcbiAgICAvLyB9XG4gICAgc2V0S2V5KGtleSwgc2NoZW1hKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmF1Z21lbnQoeyBba2V5XTogc2NoZW1hIH0pO1xuICAgIH1cbiAgICAvLyBtZXJnZTxJbmNvbWluZyBleHRlbmRzIEFueVpvZE9iamVjdD4oXG4gICAgLy8gICBtZXJnaW5nOiBJbmNvbWluZ1xuICAgIC8vICk6IC8vWm9kT2JqZWN0PFQgJiBJbmNvbWluZ1tcIl9zaGFwZVwiXSwgVW5rbm93bktleXMsIENhdGNoYWxsPiA9IChtZXJnaW5nKSA9PiB7XG4gICAgLy8gWm9kT2JqZWN0PFxuICAgIC8vICAgZXh0ZW5kU2hhcGU8VCwgUmV0dXJuVHlwZTxJbmNvbWluZ1tcIl9kZWZcIl1bXCJzaGFwZVwiXT4+LFxuICAgIC8vICAgSW5jb21pbmdbXCJfZGVmXCJdW1widW5rbm93bktleXNcIl0sXG4gICAgLy8gICBJbmNvbWluZ1tcIl9kZWZcIl1bXCJjYXRjaGFsbFwiXVxuICAgIC8vID4ge1xuICAgIC8vICAgLy8gY29uc3QgbWVyZ2VkU2hhcGUgPSBvYmplY3RVdGlsLm1lcmdlU2hhcGVzKFxuICAgIC8vICAgLy8gICB0aGlzLl9kZWYuc2hhcGUoKSxcbiAgICAvLyAgIC8vICAgbWVyZ2luZy5fZGVmLnNoYXBlKClcbiAgICAvLyAgIC8vICk7XG4gICAgLy8gICBjb25zdCBtZXJnZWQ6IGFueSA9IG5ldyBab2RPYmplY3Qoe1xuICAgIC8vICAgICB1bmtub3duS2V5czogbWVyZ2luZy5fZGVmLnVua25vd25LZXlzLFxuICAgIC8vICAgICBjYXRjaGFsbDogbWVyZ2luZy5fZGVmLmNhdGNoYWxsLFxuICAgIC8vICAgICBzaGFwZTogKCkgPT5cbiAgICAvLyAgICAgICBvYmplY3RVdGlsLm1lcmdlU2hhcGVzKHRoaXMuX2RlZi5zaGFwZSgpLCBtZXJnaW5nLl9kZWYuc2hhcGUoKSksXG4gICAgLy8gICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kT2JqZWN0LFxuICAgIC8vICAgfSkgYXMgYW55O1xuICAgIC8vICAgcmV0dXJuIG1lcmdlZDtcbiAgICAvLyB9XG4gICAgY2F0Y2hhbGwoaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RPYmplY3Qoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgY2F0Y2hhbGw6IGluZGV4LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcGljayhtYXNrKSB7XG4gICAgICAgIGNvbnN0IHNoYXBlID0ge307XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIHV0aWwub2JqZWN0S2V5cyhtYXNrKSkge1xuICAgICAgICAgICAgaWYgKG1hc2tba2V5XSAmJiB0aGlzLnNoYXBlW2tleV0pIHtcbiAgICAgICAgICAgICAgICBzaGFwZVtrZXldID0gdGhpcy5zaGFwZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHNoYXBlOiAoKSA9PiBzaGFwZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG9taXQobWFzaykge1xuICAgICAgICBjb25zdCBzaGFwZSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiB1dGlsLm9iamVjdEtleXModGhpcy5zaGFwZSkpIHtcbiAgICAgICAgICAgIGlmICghbWFza1trZXldKSB7XG4gICAgICAgICAgICAgICAgc2hhcGVba2V5XSA9IHRoaXMuc2hhcGVba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBzaGFwZTogKCkgPT4gc2hhcGUsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqL1xuICAgIGRlZXBQYXJ0aWFsKCkge1xuICAgICAgICByZXR1cm4gZGVlcFBhcnRpYWxpZnkodGhpcyk7XG4gICAgfVxuICAgIHBhcnRpYWwobWFzaykge1xuICAgICAgICBjb25zdCBuZXdTaGFwZSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiB1dGlsLm9iamVjdEtleXModGhpcy5zaGFwZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpZWxkU2NoZW1hID0gdGhpcy5zaGFwZVtrZXldO1xuICAgICAgICAgICAgaWYgKG1hc2sgJiYgIW1hc2tba2V5XSkge1xuICAgICAgICAgICAgICAgIG5ld1NoYXBlW2tleV0gPSBmaWVsZFNjaGVtYTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld1NoYXBlW2tleV0gPSBmaWVsZFNjaGVtYS5vcHRpb25hbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHNoYXBlOiAoKSA9PiBuZXdTaGFwZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJlcXVpcmVkKG1hc2spIHtcbiAgICAgICAgY29uc3QgbmV3U2hhcGUgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgdXRpbC5vYmplY3RLZXlzKHRoaXMuc2hhcGUpKSB7XG4gICAgICAgICAgICBpZiAobWFzayAmJiAhbWFza1trZXldKSB7XG4gICAgICAgICAgICAgICAgbmV3U2hhcGVba2V5XSA9IHRoaXMuc2hhcGVba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpZWxkU2NoZW1hID0gdGhpcy5zaGFwZVtrZXldO1xuICAgICAgICAgICAgICAgIGxldCBuZXdGaWVsZCA9IGZpZWxkU2NoZW1hO1xuICAgICAgICAgICAgICAgIHdoaWxlIChuZXdGaWVsZCBpbnN0YW5jZW9mIFpvZE9wdGlvbmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0ZpZWxkID0gbmV3RmllbGQuX2RlZi5pbm5lclR5cGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5ld1NoYXBlW2tleV0gPSBuZXdGaWVsZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBzaGFwZTogKCkgPT4gbmV3U2hhcGUsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBrZXlvZigpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVpvZEVudW0odXRpbC5vYmplY3RLZXlzKHRoaXMuc2hhcGUpKTtcbiAgICB9XG59XG5ab2RPYmplY3QuY3JlYXRlID0gKHNoYXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgIHNoYXBlOiAoKSA9PiBzaGFwZSxcbiAgICAgICAgdW5rbm93bktleXM6IFwic3RyaXBcIixcbiAgICAgICAgY2F0Y2hhbGw6IFpvZE5ldmVyLmNyZWF0ZSgpLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE9iamVjdCxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcblpvZE9iamVjdC5zdHJpY3RDcmVhdGUgPSAoc2hhcGUsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgc2hhcGU6ICgpID0+IHNoYXBlLFxuICAgICAgICB1bmtub3duS2V5czogXCJzdHJpY3RcIixcbiAgICAgICAgY2F0Y2hhbGw6IFpvZE5ldmVyLmNyZWF0ZSgpLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE9iamVjdCxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcblpvZE9iamVjdC5sYXp5Y3JlYXRlID0gKHNoYXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgIHNoYXBlLFxuICAgICAgICB1bmtub3duS2V5czogXCJzdHJpcFwiLFxuICAgICAgICBjYXRjaGFsbDogWm9kTmV2ZXIuY3JlYXRlKCksXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kT2JqZWN0LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZFVuaW9uIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fZGVmLm9wdGlvbnM7XG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZVJlc3VsdHMocmVzdWx0cykge1xuICAgICAgICAgICAgLy8gcmV0dXJuIGZpcnN0IGlzc3VlLWZyZWUgdmFsaWRhdGlvbiBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnJlc3VsdC5zdGF0dXMgPT09IFwidmFsaWRcIikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnJlc3VsdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5yZXN1bHQuc3RhdHVzID09PSBcImRpcnR5XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIGlzc3VlcyBmcm9tIGRpcnR5IG9wdGlvblxuICAgICAgICAgICAgICAgICAgICBjdHguY29tbW9uLmlzc3Vlcy5wdXNoKC4uLnJlc3VsdC5jdHguY29tbW9uLmlzc3Vlcyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQucmVzdWx0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJldHVybiBpbnZhbGlkXG4gICAgICAgICAgICBjb25zdCB1bmlvbkVycm9ycyA9IHJlc3VsdHMubWFwKChyZXN1bHQpID0+IG5ldyBab2RFcnJvcihyZXN1bHQuY3R4LmNvbW1vbi5pc3N1ZXMpKTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3VuaW9uLFxuICAgICAgICAgICAgICAgIHVuaW9uRXJyb3JzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3R4LmNvbW1vbi5hc3luYykge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKG9wdGlvbnMubWFwKGFzeW5jIChvcHRpb24pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEN0eCA9IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uY3R4LFxuICAgICAgICAgICAgICAgICAgICBjb21tb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLmN0eC5jb21tb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBpc3N1ZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQ6IGF3YWl0IG9wdGlvbi5fcGFyc2VBc3luYyh7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBjaGlsZEN0eCxcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgIGN0eDogY2hpbGRDdHgsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pKS50aGVuKGhhbmRsZVJlc3VsdHMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IGRpcnR5ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgY29uc3QgaXNzdWVzID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG9wdGlvbiBvZiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRDdHggPSB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmN0eCxcbiAgICAgICAgICAgICAgICAgICAgY29tbW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5jdHguY29tbW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNzdWVzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gb3B0aW9uLl9wYXJzZVN5bmMoe1xuICAgICAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogY2hpbGRDdHgsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IFwidmFsaWRcIikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChyZXN1bHQuc3RhdHVzID09PSBcImRpcnR5XCIgJiYgIWRpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRpcnR5ID0geyByZXN1bHQsIGN0eDogY2hpbGRDdHggfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkQ3R4LmNvbW1vbi5pc3N1ZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKGNoaWxkQ3R4LmNvbW1vbi5pc3N1ZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkaXJ0eSkge1xuICAgICAgICAgICAgICAgIGN0eC5jb21tb24uaXNzdWVzLnB1c2goLi4uZGlydHkuY3R4LmNvbW1vbi5pc3N1ZXMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBkaXJ0eS5yZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB1bmlvbkVycm9ycyA9IGlzc3Vlcy5tYXAoKGlzc3VlcykgPT4gbmV3IFpvZEVycm9yKGlzc3VlcykpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdW5pb24sXG4gICAgICAgICAgICAgICAgdW5pb25FcnJvcnMsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgfVxuICAgIGdldCBvcHRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLm9wdGlvbnM7XG4gICAgfVxufVxuWm9kVW5pb24uY3JlYXRlID0gKHR5cGVzLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFVuaW9uKHtcbiAgICAgICAgb3B0aW9uczogdHlwZXMsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kVW5pb24sXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vLy8vLy8vLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLy8vLy8vLy8vXG4vLy8vLy8vLy8vICAgICAgWm9kRGlzY3JpbWluYXRlZFVuaW9uICAgICAgLy8vLy8vLy8vL1xuLy8vLy8vLy8vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vLy8vLy8vLy9cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuY29uc3QgZ2V0RGlzY3JpbWluYXRvciA9ICh0eXBlKSA9PiB7XG4gICAgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2RMYXp5KSB7XG4gICAgICAgIHJldHVybiBnZXREaXNjcmltaW5hdG9yKHR5cGUuc2NoZW1hKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZEVmZmVjdHMpIHtcbiAgICAgICAgcmV0dXJuIGdldERpc2NyaW1pbmF0b3IodHlwZS5pbm5lclR5cGUoKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2RMaXRlcmFsKSB7XG4gICAgICAgIHJldHVybiBbdHlwZS52YWx1ZV07XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2RFbnVtKSB7XG4gICAgICAgIHJldHVybiB0eXBlLm9wdGlvbnM7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2ROYXRpdmVFbnVtKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBiYW4vYmFuXG4gICAgICAgIHJldHVybiB1dGlsLm9iamVjdFZhbHVlcyh0eXBlLmVudW0pO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgWm9kRGVmYXVsdCkge1xuICAgICAgICByZXR1cm4gZ2V0RGlzY3JpbWluYXRvcih0eXBlLl9kZWYuaW5uZXJUeXBlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZFVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gW3VuZGVmaW5lZF07XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2ROdWxsKSB7XG4gICAgICAgIHJldHVybiBbbnVsbF07XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2RPcHRpb25hbCkge1xuICAgICAgICByZXR1cm4gW3VuZGVmaW5lZCwgLi4uZ2V0RGlzY3JpbWluYXRvcih0eXBlLnVud3JhcCgpKV07XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2ROdWxsYWJsZSkge1xuICAgICAgICByZXR1cm4gW251bGwsIC4uLmdldERpc2NyaW1pbmF0b3IodHlwZS51bndyYXAoKSldO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgWm9kQnJhbmRlZCkge1xuICAgICAgICByZXR1cm4gZ2V0RGlzY3JpbWluYXRvcih0eXBlLnVud3JhcCgpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZFJlYWRvbmx5KSB7XG4gICAgICAgIHJldHVybiBnZXREaXNjcmltaW5hdG9yKHR5cGUudW53cmFwKCkpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgWm9kQ2F0Y2gpIHtcbiAgICAgICAgcmV0dXJuIGdldERpc2NyaW1pbmF0b3IodHlwZS5fZGVmLmlubmVyVHlwZSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxufTtcbmV4cG9ydCBjbGFzcyBab2REaXNjcmltaW5hdGVkVW5pb24gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5vYmplY3QpIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUub2JqZWN0LFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGlzY3JpbWluYXRvciA9IHRoaXMuZGlzY3JpbWluYXRvcjtcbiAgICAgICAgY29uc3QgZGlzY3JpbWluYXRvclZhbHVlID0gY3R4LmRhdGFbZGlzY3JpbWluYXRvcl07XG4gICAgICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9uc01hcC5nZXQoZGlzY3JpbWluYXRvclZhbHVlKTtcbiAgICAgICAgaWYgKCFvcHRpb24pIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3VuaW9uX2Rpc2NyaW1pbmF0b3IsXG4gICAgICAgICAgICAgICAgb3B0aW9uczogQXJyYXkuZnJvbSh0aGlzLm9wdGlvbnNNYXAua2V5cygpKSxcbiAgICAgICAgICAgICAgICBwYXRoOiBbZGlzY3JpbWluYXRvcl0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLl9wYXJzZUFzeW5jKHtcbiAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi5fcGFyc2VTeW5jKHtcbiAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGdldCBkaXNjcmltaW5hdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmRpc2NyaW1pbmF0b3I7XG4gICAgfVxuICAgIGdldCBvcHRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLm9wdGlvbnM7XG4gICAgfVxuICAgIGdldCBvcHRpb25zTWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLm9wdGlvbnNNYXA7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFRoZSBjb25zdHJ1Y3RvciBvZiB0aGUgZGlzY3JpbWluYXRlZCB1bmlvbiBzY2hlbWEuIEl0cyBiZWhhdmlvdXIgaXMgdmVyeSBzaW1pbGFyIHRvIHRoYXQgb2YgdGhlIG5vcm1hbCB6LnVuaW9uKCkgY29uc3RydWN0b3IuXG4gICAgICogSG93ZXZlciwgaXQgb25seSBhbGxvd3MgYSB1bmlvbiBvZiBvYmplY3RzLCBhbGwgb2Ygd2hpY2ggbmVlZCB0byBzaGFyZSBhIGRpc2NyaW1pbmF0b3IgcHJvcGVydHkuIFRoaXMgcHJvcGVydHkgbXVzdFxuICAgICAqIGhhdmUgYSBkaWZmZXJlbnQgdmFsdWUgZm9yIGVhY2ggb2JqZWN0IGluIHRoZSB1bmlvbi5cbiAgICAgKiBAcGFyYW0gZGlzY3JpbWluYXRvciB0aGUgbmFtZSBvZiB0aGUgZGlzY3JpbWluYXRvciBwcm9wZXJ0eVxuICAgICAqIEBwYXJhbSB0eXBlcyBhbiBhcnJheSBvZiBvYmplY3Qgc2NoZW1hc1xuICAgICAqIEBwYXJhbSBwYXJhbXNcbiAgICAgKi9cbiAgICBzdGF0aWMgY3JlYXRlKGRpc2NyaW1pbmF0b3IsIG9wdGlvbnMsIHBhcmFtcykge1xuICAgICAgICAvLyBHZXQgYWxsIHRoZSB2YWxpZCBkaXNjcmltaW5hdG9yIHZhbHVlc1xuICAgICAgICBjb25zdCBvcHRpb25zTWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyB0cnkge1xuICAgICAgICBmb3IgKGNvbnN0IHR5cGUgb2Ygb3B0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgZGlzY3JpbWluYXRvclZhbHVlcyA9IGdldERpc2NyaW1pbmF0b3IodHlwZS5zaGFwZVtkaXNjcmltaW5hdG9yXSk7XG4gICAgICAgICAgICBpZiAoIWRpc2NyaW1pbmF0b3JWYWx1ZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBIGRpc2NyaW1pbmF0b3IgdmFsdWUgZm9yIGtleSBcXGAke2Rpc2NyaW1pbmF0b3J9XFxgIGNvdWxkIG5vdCBiZSBleHRyYWN0ZWQgZnJvbSBhbGwgc2NoZW1hIG9wdGlvbnNgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgZGlzY3JpbWluYXRvclZhbHVlcykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zTWFwLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBEaXNjcmltaW5hdG9yIHByb3BlcnR5ICR7U3RyaW5nKGRpc2NyaW1pbmF0b3IpfSBoYXMgZHVwbGljYXRlIHZhbHVlICR7U3RyaW5nKHZhbHVlKX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3B0aW9uc01hcC5zZXQodmFsdWUsIHR5cGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWm9kRGlzY3JpbWluYXRlZFVuaW9uKHtcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRGlzY3JpbWluYXRlZFVuaW9uLFxuICAgICAgICAgICAgZGlzY3JpbWluYXRvcixcbiAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICBvcHRpb25zTWFwLFxuICAgICAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5mdW5jdGlvbiBtZXJnZVZhbHVlcyhhLCBiKSB7XG4gICAgY29uc3QgYVR5cGUgPSBnZXRQYXJzZWRUeXBlKGEpO1xuICAgIGNvbnN0IGJUeXBlID0gZ2V0UGFyc2VkVHlwZShiKTtcbiAgICBpZiAoYSA9PT0gYikge1xuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgZGF0YTogYSB9O1xuICAgIH1cbiAgICBlbHNlIGlmIChhVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS5vYmplY3QgJiYgYlR5cGUgPT09IFpvZFBhcnNlZFR5cGUub2JqZWN0KSB7XG4gICAgICAgIGNvbnN0IGJLZXlzID0gdXRpbC5vYmplY3RLZXlzKGIpO1xuICAgICAgICBjb25zdCBzaGFyZWRLZXlzID0gdXRpbC5vYmplY3RLZXlzKGEpLmZpbHRlcigoa2V5KSA9PiBiS2V5cy5pbmRleE9mKGtleSkgIT09IC0xKTtcbiAgICAgICAgY29uc3QgbmV3T2JqID0geyAuLi5hLCAuLi5iIH07XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIHNoYXJlZEtleXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZFZhbHVlID0gbWVyZ2VWYWx1ZXMoYVtrZXldLCBiW2tleV0pO1xuICAgICAgICAgICAgaWYgKCFzaGFyZWRWYWx1ZS52YWxpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBzaGFyZWRWYWx1ZS5kYXRhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCBkYXRhOiBuZXdPYmogfTtcbiAgICB9XG4gICAgZWxzZSBpZiAoYVR5cGUgPT09IFpvZFBhcnNlZFR5cGUuYXJyYXkgJiYgYlR5cGUgPT09IFpvZFBhcnNlZFR5cGUuYXJyYXkpIHtcbiAgICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlIH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbmV3QXJyYXkgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtQSA9IGFbaW5kZXhdO1xuICAgICAgICAgICAgY29uc3QgaXRlbUIgPSBiW2luZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZFZhbHVlID0gbWVyZ2VWYWx1ZXMoaXRlbUEsIGl0ZW1CKTtcbiAgICAgICAgICAgIGlmICghc2hhcmVkVmFsdWUudmFsaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5ld0FycmF5LnB1c2goc2hhcmVkVmFsdWUuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IHRydWUsIGRhdGE6IG5ld0FycmF5IH07XG4gICAgfVxuICAgIGVsc2UgaWYgKGFUeXBlID09PSBab2RQYXJzZWRUeXBlLmRhdGUgJiYgYlR5cGUgPT09IFpvZFBhcnNlZFR5cGUuZGF0ZSAmJiArYSA9PT0gK2IpIHtcbiAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IHRydWUsIGRhdGE6IGEgfTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSB9O1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBab2RJbnRlcnNlY3Rpb24gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0dXMsIGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgY29uc3QgaGFuZGxlUGFyc2VkID0gKHBhcnNlZExlZnQsIHBhcnNlZFJpZ2h0KSA9PiB7XG4gICAgICAgICAgICBpZiAoaXNBYm9ydGVkKHBhcnNlZExlZnQpIHx8IGlzQWJvcnRlZChwYXJzZWRSaWdodCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IG1lcmdlVmFsdWVzKHBhcnNlZExlZnQudmFsdWUsIHBhcnNlZFJpZ2h0LnZhbHVlKTtcbiAgICAgICAgICAgIGlmICghbWVyZ2VkLnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX2ludGVyc2VjdGlvbl90eXBlcyxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpc0RpcnR5KHBhcnNlZExlZnQpIHx8IGlzRGlydHkocGFyc2VkUmlnaHQpKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6IHN0YXR1cy52YWx1ZSwgdmFsdWU6IG1lcmdlZC5kYXRhIH07XG4gICAgICAgIH07XG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgICAgIHRoaXMuX2RlZi5sZWZ0Ll9wYXJzZUFzeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICB0aGlzLl9kZWYucmlnaHQuX3BhcnNlQXN5bmMoe1xuICAgICAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgXSkudGhlbigoW2xlZnQsIHJpZ2h0XSkgPT4gaGFuZGxlUGFyc2VkKGxlZnQsIHJpZ2h0KSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaGFuZGxlUGFyc2VkKHRoaXMuX2RlZi5sZWZ0Ll9wYXJzZVN5bmMoe1xuICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgfSksIHRoaXMuX2RlZi5yaWdodC5fcGFyc2VTeW5jKHtcbiAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblpvZEludGVyc2VjdGlvbi5jcmVhdGUgPSAobGVmdCwgcmlnaHQsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kSW50ZXJzZWN0aW9uKHtcbiAgICAgICAgbGVmdDogbGVmdCxcbiAgICAgICAgcmlnaHQ6IHJpZ2h0LFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEludGVyc2VjdGlvbixcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbi8vIHR5cGUgWm9kVHVwbGVJdGVtcyA9IFtab2RUeXBlQW55LCAuLi5ab2RUeXBlQW55W11dO1xuZXhwb3J0IGNsYXNzIFpvZFR1cGxlIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzLCBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5hcnJheSkge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5hcnJheSxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHguZGF0YS5sZW5ndGggPCB0aGlzLl9kZWYuaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX3NtYWxsLFxuICAgICAgICAgICAgICAgIG1pbmltdW06IHRoaXMuX2RlZi5pdGVtcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3QgPSB0aGlzLl9kZWYucmVzdDtcbiAgICAgICAgaWYgKCFyZXN0ICYmIGN0eC5kYXRhLmxlbmd0aCA+IHRoaXMuX2RlZi5pdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fYmlnLFxuICAgICAgICAgICAgICAgIG1heGltdW06IHRoaXMuX2RlZi5pdGVtcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gWy4uLmN0eC5kYXRhXVxuICAgICAgICAgICAgLm1hcCgoaXRlbSwgaXRlbUluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzY2hlbWEgPSB0aGlzLl9kZWYuaXRlbXNbaXRlbUluZGV4XSB8fCB0aGlzLl9kZWYucmVzdDtcbiAgICAgICAgICAgIGlmICghc2NoZW1hKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmV0dXJuIHNjaGVtYS5fcGFyc2UobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIGl0ZW0sIGN0eC5wYXRoLCBpdGVtSW5kZXgpKTtcbiAgICAgICAgfSlcbiAgICAgICAgICAgIC5maWx0ZXIoKHgpID0+ICEheCk7IC8vIGZpbHRlciBudWxsc1xuICAgICAgICBpZiAoY3R4LmNvbW1vbi5hc3luYykge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGl0ZW1zKS50aGVuKChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlQXJyYXkoc3RhdHVzLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlQXJyYXkoc3RhdHVzLCBpdGVtcyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IGl0ZW1zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLml0ZW1zO1xuICAgIH1cbiAgICByZXN0KHJlc3QpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RUdXBsZSh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICByZXN0LFxuICAgICAgICB9KTtcbiAgICB9XG59XG5ab2RUdXBsZS5jcmVhdGUgPSAoc2NoZW1hcywgcGFyYW1zKSA9PiB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHNjaGVtYXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IHBhc3MgYW4gYXJyYXkgb2Ygc2NoZW1hcyB0byB6LnR1cGxlKFsgLi4uIF0pXCIpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFpvZFR1cGxlKHtcbiAgICAgICAgaXRlbXM6IHNjaGVtYXMsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kVHVwbGUsXG4gICAgICAgIHJlc3Q6IG51bGwsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kUmVjb3JkIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgZ2V0IGtleVNjaGVtYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5rZXlUeXBlO1xuICAgIH1cbiAgICBnZXQgdmFsdWVTY2hlbWEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYudmFsdWVUeXBlO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0dXMsIGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgaWYgKGN0eC5wYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLm9iamVjdCkge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5vYmplY3QsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYWlycyA9IFtdO1xuICAgICAgICBjb25zdCBrZXlUeXBlID0gdGhpcy5fZGVmLmtleVR5cGU7XG4gICAgICAgIGNvbnN0IHZhbHVlVHlwZSA9IHRoaXMuX2RlZi52YWx1ZVR5cGU7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGN0eC5kYXRhKSB7XG4gICAgICAgICAgICBwYWlycy5wdXNoKHtcbiAgICAgICAgICAgICAgICBrZXk6IGtleVR5cGUuX3BhcnNlKG5ldyBQYXJzZUlucHV0TGF6eVBhdGgoY3R4LCBrZXksIGN0eC5wYXRoLCBrZXkpKSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVUeXBlLl9wYXJzZShuZXcgUGFyc2VJbnB1dExhenlQYXRoKGN0eCwgY3R4LmRhdGFba2V5XSwgY3R4LnBhdGgsIGtleSkpLFxuICAgICAgICAgICAgICAgIGFsd2F5c1NldDoga2V5IGluIGN0eC5kYXRhLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgIHJldHVybiBQYXJzZVN0YXR1cy5tZXJnZU9iamVjdEFzeW5jKHN0YXR1cywgcGFpcnMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlT2JqZWN0U3luYyhzdGF0dXMsIHBhaXJzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBnZXQgZWxlbWVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi52YWx1ZVR5cGU7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGUoZmlyc3QsIHNlY29uZCwgdGhpcmQpIHtcbiAgICAgICAgaWYgKHNlY29uZCBpbnN0YW5jZW9mIFpvZFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgWm9kUmVjb3JkKHtcbiAgICAgICAgICAgICAgICBrZXlUeXBlOiBmaXJzdCxcbiAgICAgICAgICAgICAgICB2YWx1ZVR5cGU6IHNlY29uZCxcbiAgICAgICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZFJlY29yZCxcbiAgICAgICAgICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHRoaXJkKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWm9kUmVjb3JkKHtcbiAgICAgICAgICAgIGtleVR5cGU6IFpvZFN0cmluZy5jcmVhdGUoKSxcbiAgICAgICAgICAgIHZhbHVlVHlwZTogZmlyc3QsXG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZFJlY29yZCxcbiAgICAgICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMoc2Vjb25kKSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFpvZE1hcCBleHRlbmRzIFpvZFR5cGUge1xuICAgIGdldCBrZXlTY2hlbWEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYua2V5VHlwZTtcbiAgICB9XG4gICAgZ2V0IHZhbHVlU2NoZW1hKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnZhbHVlVHlwZTtcbiAgICB9XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzLCBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5tYXApIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUubWFwLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qga2V5VHlwZSA9IHRoaXMuX2RlZi5rZXlUeXBlO1xuICAgICAgICBjb25zdCB2YWx1ZVR5cGUgPSB0aGlzLl9kZWYudmFsdWVUeXBlO1xuICAgICAgICBjb25zdCBwYWlycyA9IFsuLi5jdHguZGF0YS5lbnRyaWVzKCldLm1hcCgoW2tleSwgdmFsdWVdLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBrZXk6IGtleVR5cGUuX3BhcnNlKG5ldyBQYXJzZUlucHV0TGF6eVBhdGgoY3R4LCBrZXksIGN0eC5wYXRoLCBbaW5kZXgsIFwia2V5XCJdKSksXG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlVHlwZS5fcGFyc2UobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIHZhbHVlLCBjdHgucGF0aCwgW2luZGV4LCBcInZhbHVlXCJdKSksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbmFsTWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcGFpciBvZiBwYWlycykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBhd2FpdCBwYWlyLmtleTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCBwYWlyLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5LnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIgfHwgdmFsdWUuc3RhdHVzID09PSBcImFib3J0ZWRcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleS5zdGF0dXMgPT09IFwiZGlydHlcIiB8fCB2YWx1ZS5zdGF0dXMgPT09IFwiZGlydHlcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZmluYWxNYXAuc2V0KGtleS52YWx1ZSwgdmFsdWUudmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6IHN0YXR1cy52YWx1ZSwgdmFsdWU6IGZpbmFsTWFwIH07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbmFsTWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwYWlyIG9mIHBhaXJzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gcGFpci5rZXk7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBwYWlyLnZhbHVlO1xuICAgICAgICAgICAgICAgIGlmIChrZXkuc3RhdHVzID09PSBcImFib3J0ZWRcIiB8fCB2YWx1ZS5zdGF0dXMgPT09IFwiYWJvcnRlZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoa2V5LnN0YXR1cyA9PT0gXCJkaXJ0eVwiIHx8IHZhbHVlLnN0YXR1cyA9PT0gXCJkaXJ0eVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmaW5hbE1hcC5zZXQoa2V5LnZhbHVlLCB2YWx1ZS52YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6IHN0YXR1cy52YWx1ZSwgdmFsdWU6IGZpbmFsTWFwIH07XG4gICAgICAgIH1cbiAgICB9XG59XG5ab2RNYXAuY3JlYXRlID0gKGtleVR5cGUsIHZhbHVlVHlwZSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RNYXAoe1xuICAgICAgICB2YWx1ZVR5cGUsXG4gICAgICAgIGtleVR5cGUsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kTWFwLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZFNldCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IHN0YXR1cywgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBpZiAoY3R4LnBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUuc2V0KSB7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLnNldCxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlZiA9IHRoaXMuX2RlZjtcbiAgICAgICAgaWYgKGRlZi5taW5TaXplICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoY3R4LmRhdGEuc2l6ZSA8IGRlZi5taW5TaXplLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fc21hbGwsXG4gICAgICAgICAgICAgICAgICAgIG1pbmltdW06IGRlZi5taW5TaXplLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInNldFwiLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZGVmLm1pblNpemUubWVzc2FnZSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVmLm1heFNpemUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChjdHguZGF0YS5zaXplID4gZGVmLm1heFNpemUudmFsdWUpIHtcbiAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19iaWcsXG4gICAgICAgICAgICAgICAgICAgIG1heGltdW06IGRlZi5tYXhTaXplLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInNldFwiLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZGVmLm1heFNpemUubWVzc2FnZSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCB2YWx1ZVR5cGUgPSB0aGlzLl9kZWYudmFsdWVUeXBlO1xuICAgICAgICBmdW5jdGlvbiBmaW5hbGl6ZVNldChlbGVtZW50cykge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkU2V0ID0gbmV3IFNldCgpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQuc3RhdHVzID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIHBhcnNlZFNldC5hZGQoZWxlbWVudC52YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6IHN0YXR1cy52YWx1ZSwgdmFsdWU6IHBhcnNlZFNldCB9O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVsZW1lbnRzID0gWy4uLmN0eC5kYXRhLnZhbHVlcygpXS5tYXAoKGl0ZW0sIGkpID0+IHZhbHVlVHlwZS5fcGFyc2UobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIGl0ZW0sIGN0eC5wYXRoLCBpKSkpO1xuICAgICAgICBpZiAoY3R4LmNvbW1vbi5hc3luYykge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGVsZW1lbnRzKS50aGVuKChlbGVtZW50cykgPT4gZmluYWxpemVTZXQoZWxlbWVudHMpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmaW5hbGl6ZVNldChlbGVtZW50cyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgbWluKG1pblNpemUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RTZXQoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgbWluU2l6ZTogeyB2YWx1ZTogbWluU2l6ZSwgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBtYXgobWF4U2l6ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZFNldCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBtYXhTaXplOiB7IHZhbHVlOiBtYXhTaXplLCBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHNpemUoc2l6ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5taW4oc2l6ZSwgbWVzc2FnZSkubWF4KHNpemUsIG1lc3NhZ2UpO1xuICAgIH1cbiAgICBub25lbXB0eShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pbigxLCBtZXNzYWdlKTtcbiAgICB9XG59XG5ab2RTZXQuY3JlYXRlID0gKHZhbHVlVHlwZSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RTZXQoe1xuICAgICAgICB2YWx1ZVR5cGUsXG4gICAgICAgIG1pblNpemU6IG51bGwsXG4gICAgICAgIG1heFNpemU6IG51bGwsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kU2V0LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZEZ1bmN0aW9uIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMudmFsaWRhdGUgPSB0aGlzLmltcGxlbWVudDtcbiAgICB9XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBpZiAoY3R4LnBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUuZnVuY3Rpb24pIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUuZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBtYWtlQXJnc0lzc3VlKGFyZ3MsIGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gbWFrZUlzc3VlKHtcbiAgICAgICAgICAgICAgICBkYXRhOiBhcmdzLFxuICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgIGVycm9yTWFwczogW2N0eC5jb21tb24uY29udGV4dHVhbEVycm9yTWFwLCBjdHguc2NoZW1hRXJyb3JNYXAsIGdldEVycm9yTWFwKCksIGRlZmF1bHRFcnJvck1hcF0uZmlsdGVyKCh4KSA9PiAhIXgpLFxuICAgICAgICAgICAgICAgIGlzc3VlRGF0YToge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9hcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50c0Vycm9yOiBlcnJvcixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gbWFrZVJldHVybnNJc3N1ZShyZXR1cm5zLCBlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIG1ha2VJc3N1ZSh7XG4gICAgICAgICAgICAgICAgZGF0YTogcmV0dXJucyxcbiAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICBlcnJvck1hcHM6IFtjdHguY29tbW9uLmNvbnRleHR1YWxFcnJvck1hcCwgY3R4LnNjaGVtYUVycm9yTWFwLCBnZXRFcnJvck1hcCgpLCBkZWZhdWx0RXJyb3JNYXBdLmZpbHRlcigoeCkgPT4gISF4KSxcbiAgICAgICAgICAgICAgICBpc3N1ZURhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfcmV0dXJuX3R5cGUsXG4gICAgICAgICAgICAgICAgICAgIHJldHVyblR5cGVFcnJvcjogZXJyb3IsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHsgZXJyb3JNYXA6IGN0eC5jb21tb24uY29udGV4dHVhbEVycm9yTWFwIH07XG4gICAgICAgIGNvbnN0IGZuID0gY3R4LmRhdGE7XG4gICAgICAgIGlmICh0aGlzLl9kZWYucmV0dXJucyBpbnN0YW5jZW9mIFpvZFByb21pc2UpIHtcbiAgICAgICAgICAgIC8vIFdvdWxkIGxvdmUgYSB3YXkgdG8gYXZvaWQgZGlzYWJsaW5nIHRoaXMgcnVsZSwgYnV0IHdlIG5lZWRcbiAgICAgICAgICAgIC8vIGFuIGFsaWFzICh1c2luZyBhbiBhcnJvdyBmdW5jdGlvbiB3YXMgd2hhdCBjYXVzZWQgMjY1MSkuXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXRoaXMtYWxpYXNcbiAgICAgICAgICAgIGNvbnN0IG1lID0gdGhpcztcbiAgICAgICAgICAgIHJldHVybiBPSyhhc3luYyBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFpvZEVycm9yKFtdKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRBcmdzID0gYXdhaXQgbWUuX2RlZi5hcmdzLnBhcnNlQXN5bmMoYXJncywgcGFyYW1zKS5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBlcnJvci5hZGRJc3N1ZShtYWtlQXJnc0lzc3VlKGFyZ3MsIGUpKTtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgUmVmbGVjdC5hcHBseShmbiwgdGhpcywgcGFyc2VkQXJncyk7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkUmV0dXJucyA9IGF3YWl0IG1lLl9kZWYucmV0dXJucy5fZGVmLnR5cGVcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQXN5bmMocmVzdWx0LCBwYXJhbXMpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBlcnJvci5hZGRJc3N1ZShtYWtlUmV0dXJuc0lzc3VlKHJlc3VsdCwgZSkpO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VkUmV0dXJucztcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gV291bGQgbG92ZSBhIHdheSB0byBhdm9pZCBkaXNhYmxpbmcgdGhpcyBydWxlLCBidXQgd2UgbmVlZFxuICAgICAgICAgICAgLy8gYW4gYWxpYXMgKHVzaW5nIGFuIGFycm93IGZ1bmN0aW9uIHdhcyB3aGF0IGNhdXNlZCAyNjUxKS5cbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdGhpcy1hbGlhc1xuICAgICAgICAgICAgY29uc3QgbWUgPSB0aGlzO1xuICAgICAgICAgICAgcmV0dXJuIE9LKGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkQXJncyA9IG1lLl9kZWYuYXJncy5zYWZlUGFyc2UoYXJncywgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcnNlZEFyZ3Muc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgWm9kRXJyb3IoW21ha2VBcmdzSXNzdWUoYXJncywgcGFyc2VkQXJncy5lcnJvcildKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gUmVmbGVjdC5hcHBseShmbiwgdGhpcywgcGFyc2VkQXJncy5kYXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRSZXR1cm5zID0gbWUuX2RlZi5yZXR1cm5zLnNhZmVQYXJzZShyZXN1bHQsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgaWYgKCFwYXJzZWRSZXR1cm5zLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFpvZEVycm9yKFttYWtlUmV0dXJuc0lzc3VlKHJlc3VsdCwgcGFyc2VkUmV0dXJucy5lcnJvcildKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlZFJldHVybnMuZGF0YTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHBhcmFtZXRlcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuYXJncztcbiAgICB9XG4gICAgcmV0dXJuVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5yZXR1cm5zO1xuICAgIH1cbiAgICBhcmdzKC4uLml0ZW1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kRnVuY3Rpb24oe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgYXJnczogWm9kVHVwbGUuY3JlYXRlKGl0ZW1zKS5yZXN0KFpvZFVua25vd24uY3JlYXRlKCkpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJucyhyZXR1cm5UeXBlKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kRnVuY3Rpb24oe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgcmV0dXJuczogcmV0dXJuVHlwZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGltcGxlbWVudChmdW5jKSB7XG4gICAgICAgIGNvbnN0IHZhbGlkYXRlZEZ1bmMgPSB0aGlzLnBhcnNlKGZ1bmMpO1xuICAgICAgICByZXR1cm4gdmFsaWRhdGVkRnVuYztcbiAgICB9XG4gICAgc3RyaWN0SW1wbGVtZW50KGZ1bmMpIHtcbiAgICAgICAgY29uc3QgdmFsaWRhdGVkRnVuYyA9IHRoaXMucGFyc2UoZnVuYyk7XG4gICAgICAgIHJldHVybiB2YWxpZGF0ZWRGdW5jO1xuICAgIH1cbiAgICBzdGF0aWMgY3JlYXRlKGFyZ3MsIHJldHVybnMsIHBhcmFtcykge1xuICAgICAgICByZXR1cm4gbmV3IFpvZEZ1bmN0aW9uKHtcbiAgICAgICAgICAgIGFyZ3M6IChhcmdzID8gYXJncyA6IFpvZFR1cGxlLmNyZWF0ZShbXSkucmVzdChab2RVbmtub3duLmNyZWF0ZSgpKSksXG4gICAgICAgICAgICByZXR1cm5zOiByZXR1cm5zIHx8IFpvZFVua25vd24uY3JlYXRlKCksXG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEZ1bmN0aW9uLFxuICAgICAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgWm9kTGF6eSBleHRlbmRzIFpvZFR5cGUge1xuICAgIGdldCBzY2hlbWEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuZ2V0dGVyKCk7XG4gICAgfVxuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgY29uc3QgbGF6eVNjaGVtYSA9IHRoaXMuX2RlZi5nZXR0ZXIoKTtcbiAgICAgICAgcmV0dXJuIGxhenlTY2hlbWEuX3BhcnNlKHsgZGF0YTogY3R4LmRhdGEsIHBhdGg6IGN0eC5wYXRoLCBwYXJlbnQ6IGN0eCB9KTtcbiAgICB9XG59XG5ab2RMYXp5LmNyZWF0ZSA9IChnZXR0ZXIsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kTGF6eSh7XG4gICAgICAgIGdldHRlcjogZ2V0dGVyLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZExhenksXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kTGl0ZXJhbCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBpZiAoaW5wdXQuZGF0YSAhPT0gdGhpcy5fZGVmLnZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfbGl0ZXJhbCxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogdGhpcy5fZGVmLnZhbHVlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdGF0dXM6IFwidmFsaWRcIiwgdmFsdWU6IGlucHV0LmRhdGEgfTtcbiAgICB9XG4gICAgZ2V0IHZhbHVlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnZhbHVlO1xuICAgIH1cbn1cblpvZExpdGVyYWwuY3JlYXRlID0gKHZhbHVlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZExpdGVyYWwoe1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kTGl0ZXJhbCxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmZ1bmN0aW9uIGNyZWF0ZVpvZEVudW0odmFsdWVzLCBwYXJhbXMpIHtcbiAgICByZXR1cm4gbmV3IFpvZEVudW0oe1xuICAgICAgICB2YWx1ZXMsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRW51bSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufVxuZXhwb3J0IGNsYXNzIFpvZEVudW0gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBpbnB1dC5kYXRhICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBjb25zdCBleHBlY3RlZFZhbHVlcyA9IHRoaXMuX2RlZi52YWx1ZXM7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogdXRpbC5qb2luVmFsdWVzKGV4cGVjdGVkVmFsdWVzKSxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLl9jYWNoZSkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGUgPSBuZXcgU2V0KHRoaXMuX2RlZi52YWx1ZXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5fY2FjaGUuaGFzKGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBjb25zdCBleHBlY3RlZFZhbHVlcyA9IHRoaXMuX2RlZi52YWx1ZXM7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfZW51bV92YWx1ZSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBleHBlY3RlZFZhbHVlcyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9LKGlucHV0LmRhdGEpO1xuICAgIH1cbiAgICBnZXQgb3B0aW9ucygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi52YWx1ZXM7XG4gICAgfVxuICAgIGdldCBlbnVtKCkge1xuICAgICAgICBjb25zdCBlbnVtVmFsdWVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgdmFsIG9mIHRoaXMuX2RlZi52YWx1ZXMpIHtcbiAgICAgICAgICAgIGVudW1WYWx1ZXNbdmFsXSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZW51bVZhbHVlcztcbiAgICB9XG4gICAgZ2V0IFZhbHVlcygpIHtcbiAgICAgICAgY29uc3QgZW51bVZhbHVlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IHZhbCBvZiB0aGlzLl9kZWYudmFsdWVzKSB7XG4gICAgICAgICAgICBlbnVtVmFsdWVzW3ZhbF0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVudW1WYWx1ZXM7XG4gICAgfVxuICAgIGdldCBFbnVtKCkge1xuICAgICAgICBjb25zdCBlbnVtVmFsdWVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgdmFsIG9mIHRoaXMuX2RlZi52YWx1ZXMpIHtcbiAgICAgICAgICAgIGVudW1WYWx1ZXNbdmFsXSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZW51bVZhbHVlcztcbiAgICB9XG4gICAgZXh0cmFjdCh2YWx1ZXMsIG5ld0RlZiA9IHRoaXMuX2RlZikge1xuICAgICAgICByZXR1cm4gWm9kRW51bS5jcmVhdGUodmFsdWVzLCB7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICAuLi5uZXdEZWYsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBleGNsdWRlKHZhbHVlcywgbmV3RGVmID0gdGhpcy5fZGVmKSB7XG4gICAgICAgIHJldHVybiBab2RFbnVtLmNyZWF0ZSh0aGlzLm9wdGlvbnMuZmlsdGVyKChvcHQpID0+ICF2YWx1ZXMuaW5jbHVkZXMob3B0KSksIHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIC4uLm5ld0RlZixcbiAgICAgICAgfSk7XG4gICAgfVxufVxuWm9kRW51bS5jcmVhdGUgPSBjcmVhdGVab2RFbnVtO1xuZXhwb3J0IGNsYXNzIFpvZE5hdGl2ZUVudW0gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgbmF0aXZlRW51bVZhbHVlcyA9IHV0aWwuZ2V0VmFsaWRFbnVtVmFsdWVzKHRoaXMuX2RlZi52YWx1ZXMpO1xuICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5zdHJpbmcgJiYgY3R4LnBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUubnVtYmVyKSB7XG4gICAgICAgICAgICBjb25zdCBleHBlY3RlZFZhbHVlcyA9IHV0aWwub2JqZWN0VmFsdWVzKG5hdGl2ZUVudW1WYWx1ZXMpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IHV0aWwuam9pblZhbHVlcyhleHBlY3RlZFZhbHVlcyksXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5fY2FjaGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlID0gbmV3IFNldCh1dGlsLmdldFZhbGlkRW51bVZhbHVlcyh0aGlzLl9kZWYudmFsdWVzKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLl9jYWNoZS5oYXMoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVmFsdWVzID0gdXRpbC5vYmplY3RWYWx1ZXMobmF0aXZlRW51bVZhbHVlcyk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfZW51bV92YWx1ZSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBleHBlY3RlZFZhbHVlcyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9LKGlucHV0LmRhdGEpO1xuICAgIH1cbiAgICBnZXQgZW51bSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi52YWx1ZXM7XG4gICAgfVxufVxuWm9kTmF0aXZlRW51bS5jcmVhdGUgPSAodmFsdWVzLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZE5hdGl2ZUVudW0oe1xuICAgICAgICB2YWx1ZXM6IHZhbHVlcyxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2ROYXRpdmVFbnVtLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZFByb21pc2UgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICB1bndyYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYudHlwZTtcbiAgICB9XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBpZiAoY3R4LnBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUucHJvbWlzZSAmJiBjdHguY29tbW9uLmFzeW5jID09PSBmYWxzZSkge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5wcm9taXNlLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcHJvbWlzaWZpZWQgPSBjdHgucGFyc2VkVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS5wcm9taXNlID8gY3R4LmRhdGEgOiBQcm9taXNlLnJlc29sdmUoY3R4LmRhdGEpO1xuICAgICAgICByZXR1cm4gT0socHJvbWlzaWZpZWQudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi50eXBlLnBhcnNlQXN5bmMoZGF0YSwge1xuICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgIGVycm9yTWFwOiBjdHguY29tbW9uLmNvbnRleHR1YWxFcnJvck1hcCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KSk7XG4gICAgfVxufVxuWm9kUHJvbWlzZS5jcmVhdGUgPSAoc2NoZW1hLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFByb21pc2Uoe1xuICAgICAgICB0eXBlOiBzY2hlbWEsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kUHJvbWlzZSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2RFZmZlY3RzIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgaW5uZXJUeXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnNjaGVtYTtcbiAgICB9XG4gICAgc291cmNlVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5zY2hlbWEuX2RlZi50eXBlTmFtZSA9PT0gWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEVmZmVjdHNcbiAgICAgICAgICAgID8gdGhpcy5fZGVmLnNjaGVtYS5zb3VyY2VUeXBlKClcbiAgICAgICAgICAgIDogdGhpcy5fZGVmLnNjaGVtYTtcbiAgICB9XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzLCBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGNvbnN0IGVmZmVjdCA9IHRoaXMuX2RlZi5lZmZlY3QgfHwgbnVsbDtcbiAgICAgICAgY29uc3QgY2hlY2tDdHggPSB7XG4gICAgICAgICAgICBhZGRJc3N1ZTogKGFyZykgPT4ge1xuICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwgYXJnKTtcbiAgICAgICAgICAgICAgICBpZiAoYXJnLmZhdGFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5hYm9ydCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldCBwYXRoKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdHgucGF0aDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICAgIGNoZWNrQ3R4LmFkZElzc3VlID0gY2hlY2tDdHguYWRkSXNzdWUuYmluZChjaGVja0N0eCk7XG4gICAgICAgIGlmIChlZmZlY3QudHlwZSA9PT0gXCJwcmVwcm9jZXNzXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZCA9IGVmZmVjdC50cmFuc2Zvcm0oY3R4LmRhdGEsIGNoZWNrQ3R4KTtcbiAgICAgICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShwcm9jZXNzZWQpLnRoZW4oYXN5bmMgKHByb2Nlc3NlZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHVzLnZhbHVlID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9kZWYuc2NoZW1hLl9wYXJzZUFzeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHByb2Nlc3NlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IFwiZGlydHlcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBESVJUWShyZXN1bHQudmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHVzLnZhbHVlID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gRElSVFkocmVzdWx0LnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0dXMudmFsdWUgPT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9kZWYuc2NoZW1hLl9wYXJzZVN5bmMoe1xuICAgICAgICAgICAgICAgICAgICBkYXRhOiBwcm9jZXNzZWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBESVJUWShyZXN1bHQudmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChzdGF0dXMudmFsdWUgPT09IFwiZGlydHlcIilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIERJUlRZKHJlc3VsdC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZWZmZWN0LnR5cGUgPT09IFwicmVmaW5lbWVudFwiKSB7XG4gICAgICAgICAgICBjb25zdCBleGVjdXRlUmVmaW5lbWVudCA9IChhY2MpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBlZmZlY3QucmVmaW5lbWVudChhY2MsIGNoZWNrQ3R4KTtcbiAgICAgICAgICAgICAgICBpZiAoY3R4LmNvbW1vbi5hc3luYykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFzeW5jIHJlZmluZW1lbnQgZW5jb3VudGVyZWQgZHVyaW5nIHN5bmNocm9ub3VzIHBhcnNlIG9wZXJhdGlvbi4gVXNlIC5wYXJzZUFzeW5jIGluc3RlYWQuXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlubmVyID0gdGhpcy5fZGVmLnNjaGVtYS5fcGFyc2VTeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoaW5uZXIuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICAgICAgaWYgKGlubmVyLnN0YXR1cyA9PT0gXCJkaXJ0eVwiKVxuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gdmFsdWUgaXMgaWdub3JlZFxuICAgICAgICAgICAgICAgIGV4ZWN1dGVSZWZpbmVtZW50KGlubmVyLnZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6IHN0YXR1cy52YWx1ZSwgdmFsdWU6IGlubmVyLnZhbHVlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnNjaGVtYS5fcGFyc2VBc3luYyh7IGRhdGE6IGN0eC5kYXRhLCBwYXRoOiBjdHgucGF0aCwgcGFyZW50OiBjdHggfSkudGhlbigoaW5uZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlubmVyLnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlubmVyLnN0YXR1cyA9PT0gXCJkaXJ0eVwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBleGVjdXRlUmVmaW5lbWVudChpbm5lci52YWx1ZSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6IHN0YXR1cy52YWx1ZSwgdmFsdWU6IGlubmVyLnZhbHVlIH07XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlZmZlY3QudHlwZSA9PT0gXCJ0cmFuc2Zvcm1cIikge1xuICAgICAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZSA9IHRoaXMuX2RlZi5zY2hlbWEuX3BhcnNlU3luYyh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZhbGlkKGJhc2UpKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBlZmZlY3QudHJhbnNmb3JtKGJhc2UudmFsdWUsIGNoZWNrQ3R4KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzeW5jaHJvbm91cyB0cmFuc2Zvcm0gZW5jb3VudGVyZWQgZHVyaW5nIHN5bmNocm9ub3VzIHBhcnNlIG9wZXJhdGlvbi4gVXNlIC5wYXJzZUFzeW5jIGluc3RlYWQuYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogcmVzdWx0IH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnNjaGVtYS5fcGFyc2VBc3luYyh7IGRhdGE6IGN0eC5kYXRhLCBwYXRoOiBjdHgucGF0aCwgcGFyZW50OiBjdHggfSkudGhlbigoYmFzZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzVmFsaWQoYmFzZSkpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShlZmZlY3QudHJhbnNmb3JtKGJhc2UudmFsdWUsIGNoZWNrQ3R4KSkudGhlbigocmVzdWx0KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXMudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcmVzdWx0LFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdXRpbC5hc3NlcnROZXZlcihlZmZlY3QpO1xuICAgIH1cbn1cblpvZEVmZmVjdHMuY3JlYXRlID0gKHNjaGVtYSwgZWZmZWN0LCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZEVmZmVjdHMoe1xuICAgICAgICBzY2hlbWEsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRWZmZWN0cyxcbiAgICAgICAgZWZmZWN0LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuWm9kRWZmZWN0cy5jcmVhdGVXaXRoUHJlcHJvY2VzcyA9IChwcmVwcm9jZXNzLCBzY2hlbWEsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kRWZmZWN0cyh7XG4gICAgICAgIHNjaGVtYSxcbiAgICAgICAgZWZmZWN0OiB7IHR5cGU6IFwicHJlcHJvY2Vzc1wiLCB0cmFuc2Zvcm06IHByZXByb2Nlc3MgfSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RFZmZlY3RzLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IHsgWm9kRWZmZWN0cyBhcyBab2RUcmFuc2Zvcm1lciB9O1xuZXhwb3J0IGNsYXNzIFpvZE9wdGlvbmFsIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgPT09IFpvZFBhcnNlZFR5cGUudW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gT0sodW5kZWZpbmVkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmlubmVyVHlwZS5fcGFyc2UoaW5wdXQpO1xuICAgIH1cbiAgICB1bndyYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaW5uZXJUeXBlO1xuICAgIH1cbn1cblpvZE9wdGlvbmFsLmNyZWF0ZSA9ICh0eXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZE9wdGlvbmFsKHtcbiAgICAgICAgaW5uZXJUeXBlOiB0eXBlLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE9wdGlvbmFsLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZE51bGxhYmxlIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgPT09IFpvZFBhcnNlZFR5cGUubnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIE9LKG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaW5uZXJUeXBlLl9wYXJzZShpbnB1dCk7XG4gICAgfVxuICAgIHVud3JhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5pbm5lclR5cGU7XG4gICAgfVxufVxuWm9kTnVsbGFibGUuY3JlYXRlID0gKHR5cGUsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kTnVsbGFibGUoe1xuICAgICAgICBpbm5lclR5cGU6IHR5cGUsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kTnVsbGFibGUsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kRGVmYXVsdCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgbGV0IGRhdGEgPSBjdHguZGF0YTtcbiAgICAgICAgaWYgKGN0eC5wYXJzZWRUeXBlID09PSBab2RQYXJzZWRUeXBlLnVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGF0YSA9IHRoaXMuX2RlZi5kZWZhdWx0VmFsdWUoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmlubmVyVHlwZS5fcGFyc2Uoe1xuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZW1vdmVEZWZhdWx0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmlubmVyVHlwZTtcbiAgICB9XG59XG5ab2REZWZhdWx0LmNyZWF0ZSA9ICh0eXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZERlZmF1bHQoe1xuICAgICAgICBpbm5lclR5cGU6IHR5cGUsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRGVmYXVsdCxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB0eXBlb2YgcGFyYW1zLmRlZmF1bHQgPT09IFwiZnVuY3Rpb25cIiA/IHBhcmFtcy5kZWZhdWx0IDogKCkgPT4gcGFyYW1zLmRlZmF1bHQsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kQ2F0Y2ggZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIC8vIG5ld0N0eCBpcyB1c2VkIHRvIG5vdCBjb2xsZWN0IGlzc3VlcyBmcm9tIGlubmVyIHR5cGVzIGluIGN0eFxuICAgICAgICBjb25zdCBuZXdDdHggPSB7XG4gICAgICAgICAgICAuLi5jdHgsXG4gICAgICAgICAgICBjb21tb246IHtcbiAgICAgICAgICAgICAgICAuLi5jdHguY29tbW9uLFxuICAgICAgICAgICAgICAgIGlzc3VlczogW10sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9kZWYuaW5uZXJUeXBlLl9wYXJzZSh7XG4gICAgICAgICAgICBkYXRhOiBuZXdDdHguZGF0YSxcbiAgICAgICAgICAgIHBhdGg6IG5ld0N0eC5wYXRoLFxuICAgICAgICAgICAgcGFyZW50OiB7XG4gICAgICAgICAgICAgICAgLi4ubmV3Q3R4LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpc0FzeW5jKHJlc3VsdCkpIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiBcInZhbGlkXCIsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiByZXN1bHQuc3RhdHVzID09PSBcInZhbGlkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID8gcmVzdWx0LnZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHRoaXMuX2RlZi5jYXRjaFZhbHVlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZXQgZXJyb3IoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgWm9kRXJyb3IobmV3Q3R4LmNvbW1vbi5pc3N1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IG5ld0N0eC5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IFwidmFsaWRcIixcbiAgICAgICAgICAgICAgICB2YWx1ZTogcmVzdWx0LnN0YXR1cyA9PT0gXCJ2YWxpZFwiXG4gICAgICAgICAgICAgICAgICAgID8gcmVzdWx0LnZhbHVlXG4gICAgICAgICAgICAgICAgICAgIDogdGhpcy5fZGVmLmNhdGNoVmFsdWUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0IGVycm9yKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgWm9kRXJyb3IobmV3Q3R4LmNvbW1vbi5pc3N1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0OiBuZXdDdHguZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlbW92ZUNhdGNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmlubmVyVHlwZTtcbiAgICB9XG59XG5ab2RDYXRjaC5jcmVhdGUgPSAodHlwZSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RDYXRjaCh7XG4gICAgICAgIGlubmVyVHlwZTogdHlwZSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RDYXRjaCxcbiAgICAgICAgY2F0Y2hWYWx1ZTogdHlwZW9mIHBhcmFtcy5jYXRjaCA9PT0gXCJmdW5jdGlvblwiID8gcGFyYW1zLmNhdGNoIDogKCkgPT4gcGFyYW1zLmNhdGNoLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZE5hTiBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLm5hbikge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5uYW4sXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdGF0dXM6IFwidmFsaWRcIiwgdmFsdWU6IGlucHV0LmRhdGEgfTtcbiAgICB9XG59XG5ab2ROYU4uY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kTmFOKHtcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2ROYU4sXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY29uc3QgQlJBTkQgPSBTeW1ib2woXCJ6b2RfYnJhbmRcIik7XG5leHBvcnQgY2xhc3MgWm9kQnJhbmRlZCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgY29uc3QgZGF0YSA9IGN0eC5kYXRhO1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnR5cGUuX3BhcnNlKHtcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgdW53cmFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnR5cGU7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFpvZFBpcGVsaW5lIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzLCBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVBc3luYyA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpblJlc3VsdCA9IGF3YWl0IHRoaXMuX2RlZi5pbi5fcGFyc2VBc3luYyh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKGluUmVzdWx0LnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgIGlmIChpblJlc3VsdC5zdGF0dXMgPT09IFwiZGlydHlcIikge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIERJUlRZKGluUmVzdWx0LnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9kZWYub3V0Ll9wYXJzZUFzeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGluUmVzdWx0LnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBoYW5kbGVBc3luYygpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgaW5SZXN1bHQgPSB0aGlzLl9kZWYuaW4uX3BhcnNlU3luYyh7XG4gICAgICAgICAgICAgICAgZGF0YTogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChpblJlc3VsdC5zdGF0dXMgPT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgaWYgKGluUmVzdWx0LnN0YXR1cyA9PT0gXCJkaXJ0eVwiKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiBcImRpcnR5XCIsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBpblJlc3VsdC52YWx1ZSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5vdXQuX3BhcnNlU3luYyh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGluUmVzdWx0LnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgc3RhdGljIGNyZWF0ZShhLCBiKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kUGlwZWxpbmUoe1xuICAgICAgICAgICAgaW46IGEsXG4gICAgICAgICAgICBvdXQ6IGIsXG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZFBpcGVsaW5lLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgWm9kUmVhZG9ubHkgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fZGVmLmlubmVyVHlwZS5fcGFyc2UoaW5wdXQpO1xuICAgICAgICBjb25zdCBmcmVlemUgPSAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgaWYgKGlzVmFsaWQoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBkYXRhLnZhbHVlID0gT2JqZWN0LmZyZWV6ZShkYXRhLnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gaXNBc3luYyhyZXN1bHQpID8gcmVzdWx0LnRoZW4oKGRhdGEpID0+IGZyZWV6ZShkYXRhKSkgOiBmcmVlemUocmVzdWx0KTtcbiAgICB9XG4gICAgdW53cmFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmlubmVyVHlwZTtcbiAgICB9XG59XG5ab2RSZWFkb25seS5jcmVhdGUgPSAodHlwZSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RSZWFkb25seSh7XG4gICAgICAgIGlubmVyVHlwZTogdHlwZSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RSZWFkb25seSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vLy8vLy8vLy8gICAgICAgICAgICAgICAgICAgIC8vLy8vLy8vLy9cbi8vLy8vLy8vLy8gICAgICB6LmN1c3RvbSAgICAgIC8vLy8vLy8vLy9cbi8vLy8vLy8vLy8gICAgICAgICAgICAgICAgICAgIC8vLy8vLy8vLy9cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbmZ1bmN0aW9uIGNsZWFuUGFyYW1zKHBhcmFtcywgZGF0YSkge1xuICAgIGNvbnN0IHAgPSB0eXBlb2YgcGFyYW1zID09PSBcImZ1bmN0aW9uXCIgPyBwYXJhbXMoZGF0YSkgOiB0eXBlb2YgcGFyYW1zID09PSBcInN0cmluZ1wiID8geyBtZXNzYWdlOiBwYXJhbXMgfSA6IHBhcmFtcztcbiAgICBjb25zdCBwMiA9IHR5cGVvZiBwID09PSBcInN0cmluZ1wiID8geyBtZXNzYWdlOiBwIH0gOiBwO1xuICAgIHJldHVybiBwMjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjdXN0b20oY2hlY2ssIF9wYXJhbXMgPSB7fSwgXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKlxuICogUGFzcyBgZmF0YWxgIGludG8gdGhlIHBhcmFtcyBvYmplY3QgaW5zdGVhZDpcbiAqXG4gKiBgYGB0c1xuICogei5zdHJpbmcoKS5jdXN0b20oKHZhbCkgPT4gdmFsLmxlbmd0aCA+IDUsIHsgZmF0YWw6IGZhbHNlIH0pXG4gKiBgYGBcbiAqXG4gKi9cbmZhdGFsKSB7XG4gICAgaWYgKGNoZWNrKVxuICAgICAgICByZXR1cm4gWm9kQW55LmNyZWF0ZSgpLnN1cGVyUmVmaW5lKChkYXRhLCBjdHgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSBjaGVjayhkYXRhKTtcbiAgICAgICAgICAgIGlmIChyIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiByLnRoZW4oKHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBjbGVhblBhcmFtcyhfcGFyYW1zLCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IF9mYXRhbCA9IHBhcmFtcy5mYXRhbCA/PyBmYXRhbCA/PyB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY3R4LmFkZElzc3VlKHsgY29kZTogXCJjdXN0b21cIiwgLi4ucGFyYW1zLCBmYXRhbDogX2ZhdGFsIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBjbGVhblBhcmFtcyhfcGFyYW1zLCBkYXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfZmF0YWwgPSBwYXJhbXMuZmF0YWwgPz8gZmF0YWwgPz8gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjdHguYWRkSXNzdWUoeyBjb2RlOiBcImN1c3RvbVwiLCAuLi5wYXJhbXMsIGZhdGFsOiBfZmF0YWwgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0pO1xuICAgIHJldHVybiBab2RBbnkuY3JlYXRlKCk7XG59XG5leHBvcnQgeyBab2RUeXBlIGFzIFNjaGVtYSwgWm9kVHlwZSBhcyBab2RTY2hlbWEgfTtcbmV4cG9ydCBjb25zdCBsYXRlID0ge1xuICAgIG9iamVjdDogWm9kT2JqZWN0LmxhenljcmVhdGUsXG59O1xuZXhwb3J0IHZhciBab2RGaXJzdFBhcnR5VHlwZUtpbmQ7XG4oZnVuY3Rpb24gKFpvZEZpcnN0UGFydHlUeXBlS2luZCkge1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFN0cmluZ1wiXSA9IFwiWm9kU3RyaW5nXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kTnVtYmVyXCJdID0gXCJab2ROdW1iZXJcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2ROYU5cIl0gPSBcIlpvZE5hTlwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZEJpZ0ludFwiXSA9IFwiWm9kQmlnSW50XCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kQm9vbGVhblwiXSA9IFwiWm9kQm9vbGVhblwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZERhdGVcIl0gPSBcIlpvZERhdGVcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RTeW1ib2xcIl0gPSBcIlpvZFN5bWJvbFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFVuZGVmaW5lZFwiXSA9IFwiWm9kVW5kZWZpbmVkXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kTnVsbFwiXSA9IFwiWm9kTnVsbFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZEFueVwiXSA9IFwiWm9kQW55XCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kVW5rbm93blwiXSA9IFwiWm9kVW5rbm93blwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZE5ldmVyXCJdID0gXCJab2ROZXZlclwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFZvaWRcIl0gPSBcIlpvZFZvaWRcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RBcnJheVwiXSA9IFwiWm9kQXJyYXlcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RPYmplY3RcIl0gPSBcIlpvZE9iamVjdFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFVuaW9uXCJdID0gXCJab2RVbmlvblwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZERpc2NyaW1pbmF0ZWRVbmlvblwiXSA9IFwiWm9kRGlzY3JpbWluYXRlZFVuaW9uXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kSW50ZXJzZWN0aW9uXCJdID0gXCJab2RJbnRlcnNlY3Rpb25cIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RUdXBsZVwiXSA9IFwiWm9kVHVwbGVcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RSZWNvcmRcIl0gPSBcIlpvZFJlY29yZFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZE1hcFwiXSA9IFwiWm9kTWFwXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kU2V0XCJdID0gXCJab2RTZXRcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RGdW5jdGlvblwiXSA9IFwiWm9kRnVuY3Rpb25cIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RMYXp5XCJdID0gXCJab2RMYXp5XCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kTGl0ZXJhbFwiXSA9IFwiWm9kTGl0ZXJhbFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZEVudW1cIl0gPSBcIlpvZEVudW1cIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RFZmZlY3RzXCJdID0gXCJab2RFZmZlY3RzXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kTmF0aXZlRW51bVwiXSA9IFwiWm9kTmF0aXZlRW51bVwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZE9wdGlvbmFsXCJdID0gXCJab2RPcHRpb25hbFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZE51bGxhYmxlXCJdID0gXCJab2ROdWxsYWJsZVwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZERlZmF1bHRcIl0gPSBcIlpvZERlZmF1bHRcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RDYXRjaFwiXSA9IFwiWm9kQ2F0Y2hcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RQcm9taXNlXCJdID0gXCJab2RQcm9taXNlXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kQnJhbmRlZFwiXSA9IFwiWm9kQnJhbmRlZFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFBpcGVsaW5lXCJdID0gXCJab2RQaXBlbGluZVwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFJlYWRvbmx5XCJdID0gXCJab2RSZWFkb25seVwiO1xufSkoWm9kRmlyc3RQYXJ0eVR5cGVLaW5kIHx8IChab2RGaXJzdFBhcnR5VHlwZUtpbmQgPSB7fSkpO1xuLy8gcmVxdWlyZXMgVFMgNC40K1xuY2xhc3MgQ2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yKC4uLl8pIHsgfVxufVxuY29uc3QgaW5zdGFuY2VPZlR5cGUgPSAoXG4vLyBjb25zdCBpbnN0YW5jZU9mVHlwZSA9IDxUIGV4dGVuZHMgbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihcbmNscywgcGFyYW1zID0ge1xuICAgIG1lc3NhZ2U6IGBJbnB1dCBub3QgaW5zdGFuY2Ugb2YgJHtjbHMubmFtZX1gLFxufSkgPT4gY3VzdG9tKChkYXRhKSA9PiBkYXRhIGluc3RhbmNlb2YgY2xzLCBwYXJhbXMpO1xuY29uc3Qgc3RyaW5nVHlwZSA9IFpvZFN0cmluZy5jcmVhdGU7XG5jb25zdCBudW1iZXJUeXBlID0gWm9kTnVtYmVyLmNyZWF0ZTtcbmNvbnN0IG5hblR5cGUgPSBab2ROYU4uY3JlYXRlO1xuY29uc3QgYmlnSW50VHlwZSA9IFpvZEJpZ0ludC5jcmVhdGU7XG5jb25zdCBib29sZWFuVHlwZSA9IFpvZEJvb2xlYW4uY3JlYXRlO1xuY29uc3QgZGF0ZVR5cGUgPSBab2REYXRlLmNyZWF0ZTtcbmNvbnN0IHN5bWJvbFR5cGUgPSBab2RTeW1ib2wuY3JlYXRlO1xuY29uc3QgdW5kZWZpbmVkVHlwZSA9IFpvZFVuZGVmaW5lZC5jcmVhdGU7XG5jb25zdCBudWxsVHlwZSA9IFpvZE51bGwuY3JlYXRlO1xuY29uc3QgYW55VHlwZSA9IFpvZEFueS5jcmVhdGU7XG5jb25zdCB1bmtub3duVHlwZSA9IFpvZFVua25vd24uY3JlYXRlO1xuY29uc3QgbmV2ZXJUeXBlID0gWm9kTmV2ZXIuY3JlYXRlO1xuY29uc3Qgdm9pZFR5cGUgPSBab2RWb2lkLmNyZWF0ZTtcbmNvbnN0IGFycmF5VHlwZSA9IFpvZEFycmF5LmNyZWF0ZTtcbmNvbnN0IG9iamVjdFR5cGUgPSBab2RPYmplY3QuY3JlYXRlO1xuY29uc3Qgc3RyaWN0T2JqZWN0VHlwZSA9IFpvZE9iamVjdC5zdHJpY3RDcmVhdGU7XG5jb25zdCB1bmlvblR5cGUgPSBab2RVbmlvbi5jcmVhdGU7XG5jb25zdCBkaXNjcmltaW5hdGVkVW5pb25UeXBlID0gWm9kRGlzY3JpbWluYXRlZFVuaW9uLmNyZWF0ZTtcbmNvbnN0IGludGVyc2VjdGlvblR5cGUgPSBab2RJbnRlcnNlY3Rpb24uY3JlYXRlO1xuY29uc3QgdHVwbGVUeXBlID0gWm9kVHVwbGUuY3JlYXRlO1xuY29uc3QgcmVjb3JkVHlwZSA9IFpvZFJlY29yZC5jcmVhdGU7XG5jb25zdCBtYXBUeXBlID0gWm9kTWFwLmNyZWF0ZTtcbmNvbnN0IHNldFR5cGUgPSBab2RTZXQuY3JlYXRlO1xuY29uc3QgZnVuY3Rpb25UeXBlID0gWm9kRnVuY3Rpb24uY3JlYXRlO1xuY29uc3QgbGF6eVR5cGUgPSBab2RMYXp5LmNyZWF0ZTtcbmNvbnN0IGxpdGVyYWxUeXBlID0gWm9kTGl0ZXJhbC5jcmVhdGU7XG5jb25zdCBlbnVtVHlwZSA9IFpvZEVudW0uY3JlYXRlO1xuY29uc3QgbmF0aXZlRW51bVR5cGUgPSBab2ROYXRpdmVFbnVtLmNyZWF0ZTtcbmNvbnN0IHByb21pc2VUeXBlID0gWm9kUHJvbWlzZS5jcmVhdGU7XG5jb25zdCBlZmZlY3RzVHlwZSA9IFpvZEVmZmVjdHMuY3JlYXRlO1xuY29uc3Qgb3B0aW9uYWxUeXBlID0gWm9kT3B0aW9uYWwuY3JlYXRlO1xuY29uc3QgbnVsbGFibGVUeXBlID0gWm9kTnVsbGFibGUuY3JlYXRlO1xuY29uc3QgcHJlcHJvY2Vzc1R5cGUgPSBab2RFZmZlY3RzLmNyZWF0ZVdpdGhQcmVwcm9jZXNzO1xuY29uc3QgcGlwZWxpbmVUeXBlID0gWm9kUGlwZWxpbmUuY3JlYXRlO1xuY29uc3Qgb3N0cmluZyA9ICgpID0+IHN0cmluZ1R5cGUoKS5vcHRpb25hbCgpO1xuY29uc3Qgb251bWJlciA9ICgpID0+IG51bWJlclR5cGUoKS5vcHRpb25hbCgpO1xuY29uc3Qgb2Jvb2xlYW4gPSAoKSA9PiBib29sZWFuVHlwZSgpLm9wdGlvbmFsKCk7XG5leHBvcnQgY29uc3QgY29lcmNlID0ge1xuICAgIHN0cmluZzogKChhcmcpID0+IFpvZFN0cmluZy5jcmVhdGUoeyAuLi5hcmcsIGNvZXJjZTogdHJ1ZSB9KSksXG4gICAgbnVtYmVyOiAoKGFyZykgPT4gWm9kTnVtYmVyLmNyZWF0ZSh7IC4uLmFyZywgY29lcmNlOiB0cnVlIH0pKSxcbiAgICBib29sZWFuOiAoKGFyZykgPT4gWm9kQm9vbGVhbi5jcmVhdGUoe1xuICAgICAgICAuLi5hcmcsXG4gICAgICAgIGNvZXJjZTogdHJ1ZSxcbiAgICB9KSksXG4gICAgYmlnaW50OiAoKGFyZykgPT4gWm9kQmlnSW50LmNyZWF0ZSh7IC4uLmFyZywgY29lcmNlOiB0cnVlIH0pKSxcbiAgICBkYXRlOiAoKGFyZykgPT4gWm9kRGF0ZS5jcmVhdGUoeyAuLi5hcmcsIGNvZXJjZTogdHJ1ZSB9KSksXG59O1xuZXhwb3J0IHsgYW55VHlwZSBhcyBhbnksIGFycmF5VHlwZSBhcyBhcnJheSwgYmlnSW50VHlwZSBhcyBiaWdpbnQsIGJvb2xlYW5UeXBlIGFzIGJvb2xlYW4sIGRhdGVUeXBlIGFzIGRhdGUsIGRpc2NyaW1pbmF0ZWRVbmlvblR5cGUgYXMgZGlzY3JpbWluYXRlZFVuaW9uLCBlZmZlY3RzVHlwZSBhcyBlZmZlY3QsIGVudW1UeXBlIGFzIGVudW0sIGZ1bmN0aW9uVHlwZSBhcyBmdW5jdGlvbiwgaW5zdGFuY2VPZlR5cGUgYXMgaW5zdGFuY2VvZiwgaW50ZXJzZWN0aW9uVHlwZSBhcyBpbnRlcnNlY3Rpb24sIGxhenlUeXBlIGFzIGxhenksIGxpdGVyYWxUeXBlIGFzIGxpdGVyYWwsIG1hcFR5cGUgYXMgbWFwLCBuYW5UeXBlIGFzIG5hbiwgbmF0aXZlRW51bVR5cGUgYXMgbmF0aXZlRW51bSwgbmV2ZXJUeXBlIGFzIG5ldmVyLCBudWxsVHlwZSBhcyBudWxsLCBudWxsYWJsZVR5cGUgYXMgbnVsbGFibGUsIG51bWJlclR5cGUgYXMgbnVtYmVyLCBvYmplY3RUeXBlIGFzIG9iamVjdCwgb2Jvb2xlYW4sIG9udW1iZXIsIG9wdGlvbmFsVHlwZSBhcyBvcHRpb25hbCwgb3N0cmluZywgcGlwZWxpbmVUeXBlIGFzIHBpcGVsaW5lLCBwcmVwcm9jZXNzVHlwZSBhcyBwcmVwcm9jZXNzLCBwcm9taXNlVHlwZSBhcyBwcm9taXNlLCByZWNvcmRUeXBlIGFzIHJlY29yZCwgc2V0VHlwZSBhcyBzZXQsIHN0cmljdE9iamVjdFR5cGUgYXMgc3RyaWN0T2JqZWN0LCBzdHJpbmdUeXBlIGFzIHN0cmluZywgc3ltYm9sVHlwZSBhcyBzeW1ib2wsIGVmZmVjdHNUeXBlIGFzIHRyYW5zZm9ybWVyLCB0dXBsZVR5cGUgYXMgdHVwbGUsIHVuZGVmaW5lZFR5cGUgYXMgdW5kZWZpbmVkLCB1bmlvblR5cGUgYXMgdW5pb24sIHVua25vd25UeXBlIGFzIHVua25vd24sIHZvaWRUeXBlIGFzIHZvaWQsIH07XG5leHBvcnQgY29uc3QgTkVWRVIgPSBJTlZBTElEO1xuIiwgIi8qKlxuICogXHU3RURGXHU0RTAwXHU1MkE4XHU0RjVDXHU2QTIxXHU1NzhCIChVbmlmaWVkIEFjdGlvbiBNb2RlbClcbiAqXG4gKiBcdTg3OERcdTU0MDhcdTU2REJcdTRFMkFcdTk4NzlcdTc2RUVcdTc2ODRcdTUyQThcdTRGNUNcdThCRURcdTRFNDlcdUZGMENcdTYyQkRcdThDNjFcdTYyMTBcdTRFMDBcdTU5NTcgQUkgXHU1M0VGXHU3NkY0XHU2M0E1XHU0RjdGXHU3NTI4XHU3Njg0XHU4OUM0XHU4MzAzXHU1MkE4XHU0RjVDXHUzMDAyXG4gKiAtIFx1OEJFRFx1NEU0OVx1NTQ3RFx1NTQwRFx1RkYwOFx1NEY5QiBBSSBcdTc0MDZcdTg5RTNcdUZGMENcdTUwMUZcdTkyNzQgQnJvd3Nlci1Vc2VcdUZGMDlcbiAqIC0gXHU3Q0JFXHU3ODZFXHU1M0MyXHU2NTcwXHVGRjA4XHU0RjlCXHU1RTk1XHU1QzQyXHU3Q0JFXHU3ODZFXHU2MjY3XHU4ODRDXHVGRjBDXHU1MDFGXHU5Mjc0IFN0YWdlaGFuZC9QbGF5d3JpZ2h0XHVGRjA5XG4gKi9cbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbi8qKiBcdTU3RkFcdTc4NDBcdTUyQThcdTRGNUNcdTVCOUFcdTRFNDkgKi9cbmV4cG9ydCBjb25zdCBCYXNlQWN0aW9uU2NoZW1hID0gei5vYmplY3Qoe1xuICAvKiogXHU1MkE4XHU0RjVDXHU3QzdCXHU1NzhCICovXG4gIHR5cGU6IHouZW51bShbXG4gICAgXCJuYXZpZ2F0ZVwiLFxuICAgIFwiY2xpY2tcIixcbiAgICBcImZpbGxcIixcbiAgICBcInR5cGVcIixcbiAgICBcInNlbGVjdFwiLFxuICAgIFwiaG92ZXJcIixcbiAgICBcInNjcm9sbFwiLFxuICAgIFwicHJlc3NcIixcbiAgICBcIndhaXRcIixcbiAgICBcInNjcmVlbnNob3RcIixcbiAgICBcImV2YWx1YXRlXCIsXG4gICAgXCJhc3NlcnRcIixcbiAgICBcImV4dHJhY3RcIixcbiAgICBcInNuYXBzaG90XCIsXG4gIF0pLFxuICAvKiogXHU1MkE4XHU0RjVDXHU3NTI4XHU5MDE0XHU2M0NGXHU4RkYwXHVGRjA4XHU0RjlCIEFJIC8gXHU2NUU1XHU1RkQ3IC8gXHU1NkRFXHU2NTNFXHVGRjA5ICovXG4gIGRlc2NyaXB0aW9uOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIC8qKiBcdThCRURcdTRFNDlcdTc2RUVcdTY4MDdcdUZGMDhcdTgxRUFcdTcxMzZcdThCRURcdThBMDBcdUZGMENcdTRGOUIgQUkgXHU1QzQyXHU4OUUzXHU2NzkwXHVGRjA5ICovXG4gIGludGVudDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICAvKiogXHU2NjJGXHU1NDI2XHU3QjQ5XHU1Rjg1XHU1MkE4XHU0RjVDXHU3QTMzXHU1QjlBXHU1NDBFXHU1MThEXHU4RkQ0XHU1NkRFICovXG4gIHdhaXRVbnRpbFN0YWJsZTogei5ib29sZWFuKCkuZGVmYXVsdCh0cnVlKSxcbn0pO1xuXG4vKiogXHU1QkZDXHU4MjJBXHU1MkE4XHU0RjVDICovXG5leHBvcnQgY29uc3QgTmF2aWdhdGVBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcIm5hdmlnYXRlXCIpLFxuICB1cmw6IHouc3RyaW5nKCkudXJsKCksXG4gIC8qKiBcdTdCNDlcdTVGODVcdTdGNTFcdTdFRENcdTdBN0FcdTk1RjIgKi9cbiAgd2FpdFVudGlsOiB6XG4gICAgLmVudW0oW1wibG9hZFwiLCBcImRvbWNvbnRlbnRsb2FkZWRcIiwgXCJuZXR3b3JraWRsZVwiLCBcImNvbW1pdFwiXSlcbiAgICAuZGVmYXVsdChcIm5ldHdvcmtpZGxlXCIpLFxufSk7XG5cbi8qKiBcdTcwQjlcdTUxRkJcdTUyQThcdTRGNUNcdUZGMUFcdTY1MkZcdTYzMDFcdTU5MUFcdTc5Q0RcdTVCOUFcdTRGNERcdTdCNTZcdTc1NjUgKi9cbmV4cG9ydCBjb25zdCBDbGlja0FjdGlvblNjaGVtYSA9IEJhc2VBY3Rpb25TY2hlbWEuZXh0ZW5kKHtcbiAgdHlwZTogei5saXRlcmFsKFwiY2xpY2tcIiksXG4gIC8vIFx1NUI5QVx1NEY0RFx1NjVCOVx1NUYwRlx1RkYwOFx1NjMwOVx1NEYxOFx1NTE0OFx1N0VBN1x1NUMxRFx1OEJENVx1RkYwOVxuICBzZWxlY3Rvcjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICAvLyBcdThCRURcdTRFNDlcdTc2RUVcdTY4MDdcdTY1ODdcdTY3MkNcdUZGMDhcdTUwMUZcdTkyNzQgQnJvd3Nlci1Vc2VcdUZGMENcdTc1MjhcdTY1ODdcdTY3MkNcdTVCOUFcdTRGNERcdUZGMDlcbiAgdGV4dDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICAvLyBBSSBcdTRFQ0VcdTVGRUJcdTcxNjdcdTRFMkRcdThGRDRcdTU2REVcdTc2ODQgcmVmXHVGRjA4XHU5QUQ4XHU2NTQ4XHU3Q0JFXHU3ODZFXHU1QjlBXHU0RjREXHVGRjBDXHU1MDFGXHU5Mjc0IFN0YWdlaGFuZCBYUGF0aCAvIEFJIGxvY2F0b3JcdUZGMDlcbiAgcmVmOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIC8vIEFJIFx1OEZENFx1NTZERVx1NzY4NFx1OEJFRFx1NEU0OVx1NUI5QVx1NEY0RFx1NjNDRlx1OEZGMFxuICBzZW1hbnRpYzogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICAvKiogXHU3MEI5XHU1MUZCXHU2MzA5XHU5NEFFICovXG4gIGJ1dHRvbjogei5lbnVtKFtcImxlZnRcIiwgXCJyaWdodFwiLCBcIm1pZGRsZVwiXSkuZGVmYXVsdChcImxlZnRcIiksXG4gIC8qKiBcdTcwQjlcdTUxRkJcdTZCMjFcdTY1NzAgKi9cbiAgY2xpY2tDb3VudDogei5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDMpLmRlZmF1bHQoMSksXG4gIC8qKiBcdTVGM0FcdTUyMzZcdTVGRkRcdTc1NjVcdTUzRUZcdTY0Q0RcdTRGNUNcdTYwMjdcdTY4QzBcdTY3RTUgKi9cbiAgZm9yY2U6IHouYm9vbGVhbigpLmRlZmF1bHQoZmFsc2UpLFxuICAvKiogXHU3MEI5XHU1MUZCXHU1NDBFXHU2NjJGXHU1NDI2XHU3QjQ5XHU1Rjg1XHU5ODc1XHU5NzYyXHU1QkZDXHU4MjJBXHU3QTMzXHU1QjlBXHVGRjA4XHU3MEI5XHU1MUZCXHU5NEZFXHU2M0E1XHU4OUU2XHU1M0QxXHU4REYzXHU4RjZDXHU2NUY2XHVGRjBDXHU3QjQ5XHU1Rjg1XHU2NUIwXHU5ODc1XHU5NzYyXHU1MkEwXHU4RjdEXHU1QjhDXHU2MjEwXHU1MThEXHU4RkQ0XHU1NkRFXHVGRjA5XHUzMDAyXG4gICAqICBcdTlFRDhcdThCQTQgdHJ1ZVx1RkYwQ1x1Nzg2RVx1NEZERCBBSSBcdTcwQjlcdTUxRkJcdThERjNcdThGNkNcdTU0MEVcdThCRkJcdTUyMzBcdTc2ODRcdTY2MkZcdTdBMzNcdTVCOUFcdTU0MEVcdTc2ODRcdTk4NzVcdTk3NjJcdUZGMENcdTgwMENcdTk3NUVcdTY1RTdcdTk4NzVcdTk3NjJcdTMwMDIgKi9cbiAgd2FpdEZvck5hdmlnYXRpb246IHouYm9vbGVhbigpLmRlZmF1bHQodHJ1ZSksXG59KTtcblxuLyoqIFx1OEY5M1x1NTE2NVx1NTJBOFx1NEY1QyAqL1xuZXhwb3J0IGNvbnN0IEZpbGxBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcImZpbGxcIiksXG4gIHNlbGVjdG9yOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHRleHQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgcmVmOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHNlbWFudGljOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHZhbHVlOiB6LnN0cmluZygpLFxuICAvKiogXHU4RjkzXHU1MTY1XHU2QTIxXHU1RjBGXHVGRjFBZmlsbCBcdTUzNzNcdTY1RjZcdTU4NkJcdTUxNDUgLyB0eXBlIFx1OTAxMFx1OTUyRVx1NkEyMVx1NjJERiAqL1xufSk7XG5cbi8qKiBcdTYzRDBcdTUzRDZcdTUyQThcdTRGNUMgKi9cbmV4cG9ydCBjb25zdCBFeHRyYWN0QWN0aW9uU2NoZW1hID0gQmFzZUFjdGlvblNjaGVtYS5leHRlbmQoe1xuICB0eXBlOiB6LmxpdGVyYWwoXCJleHRyYWN0XCIpLFxuICBzZWxlY3Rvcjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICB0ZXh0OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHJlZjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBzZW1hbnRpYzogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICAvKiogXHU3RUQzXHU2Nzg0XHU1MzE2XHU2M0QwXHU1M0Q2XHU3Njg0IHNjaGVtYSBcdTYzQ0ZcdThGRjAgKi9cbiAgc2NoZW1hOiB6LnJlY29yZCh6LnN0cmluZygpLCB6LmFueSgpKS5vcHRpb25hbCgpLFxufSk7XG5cbi8qKiBcdTY1QURcdThBMDBcdTUyQThcdTRGNUMgKi9cbmV4cG9ydCBjb25zdCBBc3NlcnRBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcImFzc2VydFwiKSxcbiAgc2VsZWN0b3I6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgdGV4dDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICByZWY6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgc2VtYW50aWM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgLyoqIFx1NjVBRFx1OEEwMFx1NjVCOVx1NUYwRiAqL1xuICBtb2RlOiB6XG4gICAgLmVudW0oW1widmlzaWJsZVwiLCBcImV4aXN0c1wiLCBcImhpZGRlblwiLCBcInRleHQtY29udGFpbnNcIiwgXCJ2YWx1ZS1lcXVhbHNcIiwgXCJlbmFibGVkXCJdKVxuICAgIC5kZWZhdWx0KFwidmlzaWJsZVwiKSxcbiAgZXhwZWN0ZWQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbn0pO1xuXG4vKiogXHU2MjJBXHU1NkZFXHU1MkE4XHU0RjVDICovXG5leHBvcnQgY29uc3QgU2NyZWVuc2hvdEFjdGlvblNjaGVtYSA9IEJhc2VBY3Rpb25TY2hlbWEuZXh0ZW5kKHtcbiAgdHlwZTogei5saXRlcmFsKFwic2NyZWVuc2hvdFwiKSxcbiAgZnVsbFBhZ2U6IHouYm9vbGVhbigpLmRlZmF1bHQoZmFsc2UpLFxuICAvKiogXHU2MjJBXHU1NkZFXHU1MzNBXHU1N0RGXHVGRjA4XHU1M0VGXHU5MDA5XHVGRjBDXHU3NTI4XHU0RThFXHU4QzAzXHU4QkQ1XHU1QjlBXHU0RjREXHVGRjA5ICovXG4gIGNsaXA6IHpcbiAgICAub2JqZWN0KHtcbiAgICAgIHg6IHoubnVtYmVyKCksXG4gICAgICB5OiB6Lm51bWJlcigpLFxuICAgICAgd2lkdGg6IHoubnVtYmVyKCksXG4gICAgICBoZWlnaHQ6IHoubnVtYmVyKCksXG4gICAgfSlcbiAgICAub3B0aW9uYWwoKSxcbn0pO1xuXG4vKiogXHU2MEFDXHU1MDVDXHU1MkE4XHU0RjVDICovXG5leHBvcnQgY29uc3QgSG92ZXJBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcImhvdmVyXCIpLFxuICBzZWxlY3Rvcjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICB0ZXh0OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHJlZjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBzZW1hbnRpYzogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxufSk7XG5cbi8qKiBcdTZFREFcdTUyQThcdTUyQThcdTRGNUMgKi9cbmV4cG9ydCBjb25zdCBTY3JvbGxBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcInNjcm9sbFwiKSxcbiAgZGVsdGFYOiB6Lm51bWJlcigpLmRlZmF1bHQoMCksXG4gIGRlbHRhWTogei5udW1iZXIoKS5kZWZhdWx0KDYwMCksXG59KTtcblxuLyoqIFx1N0I0OVx1NUY4NVx1NTJBOFx1NEY1QyAqL1xuZXhwb3J0IGNvbnN0IFdhaXRBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcIndhaXRcIiksXG4gIG1zOiB6Lm51bWJlcigpLmludCgpLm1pbigwKS5kZWZhdWx0KDEwMDApLFxufSk7XG5cbi8qKiBKUyBcdTYyNjdcdTg4NENcdTUyQThcdTRGNUNcdUZGMDhcdTlBRDhcdTdFQTdcdThCQ0FcdTY1QURcdUZGMDkgKi9cbmV4cG9ydCBjb25zdCBFdmFsdWF0ZUFjdGlvblNjaGVtYSA9IEJhc2VBY3Rpb25TY2hlbWEuZXh0ZW5kKHtcbiAgdHlwZTogei5saXRlcmFsKFwiZXZhbHVhdGVcIiksXG4gIHNjcmlwdDogei5zdHJpbmcoKSxcbn0pO1xuXG4vKiogXHU2MzA5XHU5NTJFXHU1MkE4XHU0RjVDICovXG5leHBvcnQgY29uc3QgUHJlc3NBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcInByZXNzXCIpLFxuICBrZXk6IHouc3RyaW5nKCksXG59KTtcblxuLyoqIFx1OTAxMFx1OTUyRVx1OEY5M1x1NTE2NVx1NTJBOFx1NEY1QyAqL1xuZXhwb3J0IGNvbnN0IFR5cGVBY3Rpb25TY2hlbWEgPSBCYXNlQWN0aW9uU2NoZW1hLmV4dGVuZCh7XG4gIHR5cGU6IHoubGl0ZXJhbChcInR5cGVcIiksXG4gIHNlbGVjdG9yOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHRleHQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgcmVmOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHZhbHVlOiB6LnN0cmluZygpLFxuICBkZWxheTogei5udW1iZXIoKS5pbnQoKS5taW4oMCkuZGVmYXVsdCgwKSxcbn0pO1xuXG4vKiogXHU0RTBCXHU2MkM5XHU5MDA5XHU2MkU5XHU1MkE4XHU0RjVDICovXG5leHBvcnQgY29uc3QgU2VsZWN0QWN0aW9uU2NoZW1hID0gQmFzZUFjdGlvblNjaGVtYS5leHRlbmQoe1xuICB0eXBlOiB6LmxpdGVyYWwoXCJzZWxlY3RcIiksXG4gIHNlbGVjdG9yOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHJlZjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICB2YWx1ZTogei5zdHJpbmcoKSxcbn0pO1xuXG4vKiogXHU3RURGXHU0RTAwXHU1MkE4XHU0RjVDXHU4MDU0XHU1NDA4ICovXG5leHBvcnQgY29uc3QgVW5pZmllZEFjdGlvblNjaGVtYSA9IHouZGlzY3JpbWluYXRlZFVuaW9uKFwidHlwZVwiLCBbXG4gIE5hdmlnYXRlQWN0aW9uU2NoZW1hLFxuICBDbGlja0FjdGlvblNjaGVtYSxcbiAgRmlsbEFjdGlvblNjaGVtYSxcbiAgVHlwZUFjdGlvblNjaGVtYSxcbiAgU2VsZWN0QWN0aW9uU2NoZW1hLFxuICBIb3ZlckFjdGlvblNjaGVtYSxcbiAgU2Nyb2xsQWN0aW9uU2NoZW1hLFxuICBXYWl0QWN0aW9uU2NoZW1hLFxuICBFdmFsdWF0ZUFjdGlvblNjaGVtYSxcbiAgUHJlc3NBY3Rpb25TY2hlbWEsXG4gIEV4dHJhY3RBY3Rpb25TY2hlbWEsXG4gIEFzc2VydEFjdGlvblNjaGVtYSxcbiAgU2NyZWVuc2hvdEFjdGlvblNjaGVtYSxcbl0pO1xuXG5leHBvcnQgdHlwZSBVbmlmaWVkQWN0aW9uID0gei5pbmZlcjx0eXBlb2YgVW5pZmllZEFjdGlvblNjaGVtYT47XG5leHBvcnQgdHlwZSBBY3Rpb25UeXBlID0gVW5pZmllZEFjdGlvbltcInR5cGVcIl07XG5cbi8qKiBcdTUyQThcdTRGNUNcdTYyNjdcdTg4NENcdTdFRDNcdTY3OUMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgQWN0aW9uUmVzdWx0IHtcbiAgb2s6IGJvb2xlYW47XG4gIHR5cGU6IEFjdGlvblR5cGU7XG4gIC8qKiBcdTRFQkFcdTdDN0JcdTUzRUZcdThCRkJcdTc2ODRcdTdFRDNcdTY3OUNcdUZGMDhcdTRGOUIgQUkgLyBcdTY1RTVcdTVGRDdcdUZGMDkgKi9cbiAgc3VtbWFyeTogc3RyaW5nO1xuICAvKiogXHU3RUQzXHU2Nzg0XHU1MzE2XHU2NTcwXHU2MzZFXHVGRjA4XHU2M0QwXHU1M0Q2L1x1NUZFQlx1NzE2N1x1NzUyOFx1RkYwOSAqL1xuICBkYXRhPzogdW5rbm93bjtcbiAgLyoqIFx1OEMwM1x1OEJENVx1OEJDQVx1NjVBRFx1NEZFMVx1NjA2Rlx1RkYwOFx1OTRGRVx1NjNBNVx1NTIzMCBkaWFnbm9zaXMgXHU0RTJEXHU1RkMzXHVGRjA5ICovXG4gIGRpYWdub3N0aWNzPzogRGlhZ25vc3RpY1JlZltdO1xuICAvKiogXHU4MDE3XHU2NUY2ICovXG4gIGR1cmF0aW9uTXM6IG51bWJlcjtcbiAgLyoqIFx1NTFGQVx1OTUxOVx1NjVGNlx1NzY4NFx1OTUxOVx1OEJFRlx1NEZFMVx1NjA2RiAqL1xuICBlcnJvcj86IHN0cmluZztcbiAgLyoqIFx1NjI2N1x1ODg0Q1x1NTQwRVx1NzY4NFx1OTg3NVx1OTc2Mlx1NUZFQlx1NzE2N1x1NUYxNVx1NzUyOCAqL1xuICBzbmFwc2hvdFJlZj86IHN0cmluZztcbn1cblxuLyoqIFx1OEJDQVx1NjVBRFx1NUYxNVx1NzUyOFx1RkYxQVx1NjI4QVx1N0VEM1x1Njc5Q1x1NTE3M1x1ODA1NFx1NTIzMCA1IFx1NjYxRlx1OEMwM1x1OEJENVx1OEJDQVx1NjVBRFx1NEUyRFx1NUZDMyAqL1xuZXhwb3J0IGludGVyZmFjZSBEaWFnbm9zdGljUmVmIHtcbiAga2luZDogXCJjb25zb2xlXCIgfCBcIm5ldHdvcmtcIiB8IFwiZG9tXCIgfCBcInBlcmZvcm1hbmNlXCIgfCBcImpzLWV4Y2VwdGlvblwiIHwgXCJhY2Nlc3NpYmlsaXR5XCI7XG4gIHNldmVyaXR5OiBcImluZm9cIiB8IFwid2FybmluZ1wiIHwgXCJlcnJvclwiO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIC8qKiBcdTUzRUZcdTVDNTVcdTVGMDBcdTc2ODRcdThCRTZcdTYwQzVcdUZGMDhcdTU5ODIgc3RhY2tcdTMwMDFyZXF1ZXN0SWRcdUZGMDkgKi9cbiAgZGV0YWlsPzogdW5rbm93bjtcbiAgLyoqIFx1NjVGNlx1OTVGNFx1NjIzMyAqL1xuICB0aW1lc3RhbXA6IG51bWJlcjtcbn1cbiIsICIvKipcbiAqIFx1NzJCNlx1NjAwMVx1NjczQVx1RkYxQVx1OERERlx1OEUyQSBBSSBcdTU3MjhcdTk4NzVcdTk3NjJcdTRFMEFcdTc2ODRcdTY0Q0RcdTRGNUNcdTRGMUFcdThCRERcdTcyQjZcdTYwMDFcdUZGMDhcdTUwMUZcdTkyNzQgU3RhZ2VoYW5kIFx1NzY4NCBBY3QvRXh0cmFjdC9PYnNlcnZlIFx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRlx1RkYwOVxuICovXG5leHBvcnQgdHlwZSBTZXNzaW9uUGhhc2UgPVxuICB8IFwiaWRsZVwiXG4gIHwgXCJuYXZpZ2F0aW5nXCJcbiAgfCBcImFjdGluZ1wiXG4gIHwgXCJvYnNlcnZpbmdcIlxuICB8IFwiZXh0cmFjdGluZ1wiXG4gIHwgXCJkaWFnbm9zaW5nXCJcbiAgfCBcImVycm9yXCJcbiAgfCBcImRvbmVcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTZXNzaW9uU3RhdGUge1xuICBwaGFzZTogU2Vzc2lvblBoYXNlO1xuICAvKiogXHU1REYyXHU2MjY3XHU4ODRDXHU3Njg0XHU2QjY1XHU2NTcwICovXG4gIHN0ZXBzOiBudW1iZXI7XG4gIC8qKiBcdTVGNTNcdTUyNERcdTk4NzVcdTk3NjIgVVJMICovXG4gIHVybD86IHN0cmluZztcbiAgLyoqIFx1NjcwMFx1OEZEMVx1NEUwMFx1NkIyMVx1NUZFQlx1NzE2NyAqL1xuICBsYXN0U25hcHNob3RSZWY/OiBzdHJpbmc7XG4gIC8qKiBcdTY3MDBcdThGRDFcdTRFMDBcdTZCMjFcdTUyQThcdTRGNUNcdTdFRDNcdTY3OUMgKi9cbiAgbGFzdEFjdGlvbj86IHN0cmluZztcbiAgLyoqIFx1NEYxQVx1OEJERFx1NUYwMFx1NTlDQlx1NjVGNlx1OTVGNCAqL1xuICBzdGFydGVkQXQ6IG51bWJlcjtcbiAgLyoqIFx1OTUxOVx1OEJFRlx1NEZFMVx1NjA2Rlx1RkYwOFx1ODJFNVx1NTkwNFx1NEU4RSBlcnJvciBcdTk2MzZcdTZCQjVcdUZGMDkgKi9cbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTZXNzaW9uTWFjaGluZSB7XG4gIHByaXZhdGUgc3RhdGU6IFNlc3Npb25TdGF0ZTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgcGhhc2U6IFwiaWRsZVwiLFxuICAgICAgc3RlcHM6IDAsXG4gICAgICBzdGFydGVkQXQ6IERhdGUubm93KCksXG4gICAgfTtcbiAgfVxuXG4gIGdldCBzbmFwc2hvdCgpOiBSZWFkb25seTxTZXNzaW9uU3RhdGU+IHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZTtcbiAgfVxuXG4gIHRyYW5zaXRpb24obmV4dDogU2Vzc2lvblBoYXNlLCBwYXRjaD86IFBhcnRpYWw8U2Vzc2lvblN0YXRlPikge1xuICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAuLi50aGlzLnN0YXRlLFxuICAgICAgLi4ucGF0Y2gsXG4gICAgICBwaGFzZTogbmV4dCxcbiAgICB9O1xuICAgIGlmIChuZXh0ID09PSBcImFjdGluZ1wiIHx8IG5leHQgPT09IFwibmF2aWdhdGluZ1wiIHx8IG5leHQgPT09IFwib2JzZXJ2aW5nXCIgfHwgbmV4dCA9PT0gXCJleHRyYWN0aW5nXCIpIHtcbiAgICAgIHRoaXMuc3RhdGUuc3RlcHMgKz0gMTtcbiAgICB9XG4gIH1cblxuICBzZXRVcmwodXJsOiBzdHJpbmcpIHtcbiAgICB0aGlzLnN0YXRlLnVybCA9IHVybDtcbiAgfVxuXG4gIHNldEVycm9yKGVycm9yOiBzdHJpbmcpIHtcbiAgICB0aGlzLnN0YXRlLmVycm9yID0gZXJyb3I7XG4gICAgdGhpcy5zdGF0ZS5waGFzZSA9IFwiZXJyb3JcIjtcbiAgfVxuXG4gIC8qKiBcdTkxQ0RcdTdGNkVcdTRGMUFcdThCRERcdUZGMDhcdTRGOUJcdTRFMEJcdTRFMDBcdThGNkVcdTU5MERcdTc1MjhcdTU0MENcdTRFMDBcdTZENEZcdTg5QzhcdTU2NjhcdTVCOUVcdTRGOEJcdUZGMDkgKi9cbiAgcmVzZXQoKSB7XG4gICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgIHBoYXNlOiBcImlkbGVcIixcbiAgICAgIHN0ZXBzOiAwLFxuICAgICAgc3RhcnRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbn1cbiIsICIvKipcbiAqIEZvcmdlQnJvd3NlciBcdTIwMTRcdTIwMTQgXHU3RURGXHU0RTAwXHU2RDRGXHU4OUM4XHU1NjY4XHU2M0E3XHU1MjM2XHU5NUU4XHU5NzYyXHVGRjA4XHU2ODQ2XHU2N0I2XHU2ODM4XHU1RkMzXHVGRjA5XG4gKlxuICogXHU5NzYyXHU1NDExIEFJIEFnZW50IFx1NzY4NFx1NEUwMFx1N0FEOVx1NUYwRlx1NjNBNVx1NTNFM1x1RkYwQ1x1ODc4RFx1NTQwOFx1RkYxQVxuICogLSBcdTdFREZcdTRFMDBcdTUyQThcdTRGNUNcdTYyNjdcdTg4NENcdUZGMDhTdGFnZWhhbmQvUGxheXdyaWdodCBcdTdDQkVcdTc4NkUgKyBCcm93c2VyLVVzZSBcdThCRURcdTRFNDlcdUZGMDlcbiAqIC0gXHU5QUQ4XHU2NTQ4XHU5ODc1XHU5NzYyXHU1RkVCXHU3MTY3XHVGRjA4Q2hyb21lIERldlRvb2xzIE1DUCBcdTc2ODQgVG9rZW4gXHU3QjU2XHU3NTY1XHVGRjA5XG4gKiAtIDUgXHU2NjFGXHU4QzAzXHU4QkQ1XHU4QkNBXHU2NUFEXHVGRjA4Q2hyb21lIERldlRvb2xzIE1DUCBcdTgwRkRcdTUyOUJcdUZGMDlcbiAqL1xuaW1wb3J0IHR5cGUgeyBCcm93c2VyRW5naW5lLCBEaWFnbm9zdGljUmVwb3J0IH0gZnJvbSBcIi4vZW5naW5lLmpzXCI7XG5pbXBvcnQgdHlwZSB7IFVuaWZpZWRBY3Rpb24sIEFjdGlvblJlc3VsdCB9IGZyb20gXCIuL2FjdGlvbnMuanNcIjtcbmltcG9ydCB0eXBlIHsgUGFnZVNuYXBzaG90LCBTbmFwc2hvdE9wdGlvbnMgfSBmcm9tIFwiLi9zbmFwc2hvdC5qc1wiO1xuaW1wb3J0IHsgU2Vzc2lvbk1hY2hpbmUgfSBmcm9tIFwiLi9zZXNzaW9uLmpzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRm9yZ2VPcHRpb25zIHtcbiAgLyoqIFx1NTJBOFx1NEY1Q1x1OEQ4NVx1NjVGNlx1RkYwOFx1OUVEOFx1OEJBNCAzMHNcdUZGMDkgKi9cbiAgdGltZW91dE1zPzogbnVtYmVyO1xuICAvKiogXHU1RkVCXHU3MTY3XHU5RUQ4XHU4QkE0XHU5MDA5XHU5ODc5ICovXG4gIHNuYXBzaG90T3B0aW9ucz86IFNuYXBzaG90T3B0aW9ucztcbiAgLyoqIFx1NTJBOFx1NEY1Q1x1NTkzMVx1OEQyNVx1NTQwRVx1NjYyRlx1NTQyNlx1ODFFQVx1NTJBOFx1OTFDN1x1OTZDNlx1OEJDQVx1NjVBRFx1RkYwOFx1OUVEOFx1OEJBNCB0cnVlXHVGRjBDXHU0RjUzXHU3M0IwXHU4QzAzXHU4QkQ1XHU0RjE4XHU1MTQ4XHVGRjA5ICovXG4gIGF1dG9EaWFnbm9zZU9uRXJyb3I/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgRm9yZ2VCcm93c2VyIHtcbiAgcmVhZG9ubHkgc2Vzc2lvbiA9IG5ldyBTZXNzaW9uTWFjaGluZSgpO1xuICBwcml2YXRlIG9wdHM6IFJlcXVpcmVkPEZvcmdlT3B0aW9ucz47XG4gIHByaXZhdGUgZGlhZ25vc3RpY3NDYWNoZTogRGlhZ25vc3RpY1JlcG9ydCA9IHtcbiAgICBjb25zb2xlOiBbXSxcbiAgICBuZXR3b3JrOiBbXSxcbiAgICBkb206IFtdLFxuICAgIHBlcmZvcm1hbmNlOiBbXSxcbiAgICBqc0V4Y2VwdGlvbnM6IFtdLFxuICAgIGFjY2Vzc2liaWxpdHk6IFtdLFxuICB9O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgZW5naW5lOiBCcm93c2VyRW5naW5lLFxuICAgIG9wdHM6IEZvcmdlT3B0aW9ucyA9IHt9XG4gICkge1xuICAgIHRoaXMub3B0cyA9IHtcbiAgICAgIHRpbWVvdXRNczogMzBfMDAwLFxuICAgICAgc25hcHNob3RPcHRpb25zOiB7IG1heE5vZGVzOiAyMDAsIG1heFRleHRMZW5ndGg6IDgwLCB3aXRoU2VsZWN0b3JzOiB0cnVlIH0sXG4gICAgICBhdXRvRGlhZ25vc2VPbkVycm9yOiB0cnVlLFxuICAgICAgLi4ub3B0cyxcbiAgICB9O1xuICB9XG5cbiAgZ2V0IGVuZ2luZU5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lbmdpbmUubmFtZTtcbiAgfVxuXG4gIC8qKiBcdTU0MkZcdTUyQTggKi9cbiAgYXN5bmMgc3RhcnQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5lbmdpbmUuaW5pdCgpO1xuICAgIHRoaXMuc2Vzc2lvbi50cmFuc2l0aW9uKFwiaWRsZVwiKTtcbiAgfVxuXG4gIC8qKiBcdTUwNUNcdTZCNjIgKi9cbiAgYXN5bmMgc3RvcCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmVuZ2luZS5jbG9zZSgpO1xuICAgIHRoaXMuc2Vzc2lvbi50cmFuc2l0aW9uKFwiZG9uZVwiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBcdTYyNjdcdTg4NENcdTdFREZcdTRFMDBcdTUyQThcdTRGNUNcdTMwMDJcbiAgICogXHU1OTMxXHU4RDI1XHU2NUY2XHU4MUVBXHU1MkE4XHU4OUU2XHU1M0QxXHU4QkNBXHU2NUFEXHU5MUM3XHU5NkM2XHVGRjBDXHU4RkQ0XHU1NkRFXHU1RTI2XHU4QkNBXHU2NUFEXHU1RjE1XHU3NTI4XHU3Njg0XHU3RUQzXHU2NzlDXHUzMDAyXG4gICAqL1xuICBhc3luYyBhY3QoYWN0aW9uOiBVbmlmaWVkQWN0aW9uKTogUHJvbWlzZTxBY3Rpb25SZXN1bHQ+IHtcbiAgICBjb25zdCB0MCA9IERhdGUubm93KCk7XG4gICAgdGhpcy5zZXNzaW9uLnRyYW5zaXRpb24oXCJhY3RpbmdcIik7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZW5naW5lLmV4ZWN1dGUoYWN0aW9uKTtcbiAgICAgIHJlc3VsdC5kdXJhdGlvbk1zID0gRGF0ZS5ub3coKSAtIHQwO1xuICAgICAgdGhpcy5zZXNzaW9uLnNldFVybChyZXN1bHQuc3VtbWFyeS5pbmNsdWRlcyhcImh0dHBcIikgPyByZXN1bHQuc3VtbWFyeSA6ICh0aGlzLnNlc3Npb24uc25hcHNob3QudXJsID8/IFwiXCIpKTtcbiAgICAgIGlmIChyZXN1bHQub2spIHtcbiAgICAgICAgdGhpcy5zZXNzaW9uLnRyYW5zaXRpb24oXCJhY3RpbmdcIiwgeyBsYXN0QWN0aW9uOiBhY3Rpb24udHlwZSB9KTtcbiAgICAgICAgLy8gXHU1MkE4XHU0RjVDXHU1NDBFXHU5ODdBXHU2MjRCXHU5MUM3XHU5NkM2XHU2M0E3XHU1MjM2XHU1M0YwL1x1N0Y1MVx1N0VEQ1x1NUYwMlx1NUUzOFx1RkYwQ1x1NEY5QiBBSSBcdTUyMjRcdTY1QURcdTk4NzVcdTk3NjJcdTY2MkZcdTU0MjZcdTVGMDJcdTVFMzhcbiAgICAgICAgcmVzdWx0LmRpYWdub3N0aWNzID0gYXdhaXQgdGhpcy5lbmdpbmUuZGlhZ25vc2UoKS50aGVuKChkKSA9PlxuICAgICAgICAgIFtcbiAgICAgICAgICAgIC4uLmQuY29uc29sZS5maWx0ZXIoKGMpID0+IGMuc2V2ZXJpdHkgPT09IFwiZXJyb3JcIiksXG4gICAgICAgICAgICAuLi5kLm5ldHdvcmsuZmlsdGVyKChuKSA9PiBuLnNldmVyaXR5ID09PSBcImVycm9yXCIpLFxuICAgICAgICAgICAgLi4uZC5qc0V4Y2VwdGlvbnMsXG4gICAgICAgICAgXS5zbGljZSgwLCA4KVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgICBjb25zdCByZXN1bHQ6IEFjdGlvblJlc3VsdCA9IHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICB0eXBlOiBhY3Rpb24udHlwZSxcbiAgICAgICAgc3VtbWFyeTogYFx1NTJBOFx1NEY1Q1x1NjI2N1x1ODg0Q1x1NTkzMVx1OEQyNTogJHttZXNzYWdlfWAsXG4gICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSB0MCxcbiAgICAgICAgZXJyb3I6IG1lc3NhZ2UsXG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMub3B0cy5hdXRvRGlhZ25vc2VPbkVycm9yKSB7XG4gICAgICAgIC8vIDUgXHU2NjFGXHU4QzAzXHU4QkQ1XHVGRjFBXHU1OTMxXHU4RDI1XHU1MzczXHU5MUM3XHU5NkM2XHU1MTY4XHU5MUNGXHU4QkNBXHU2NUFEXHVGRjA4XHU1NDJCIERPTSBcdTc2N0RcdTVDNEYvXHU2NzJBXHU2RTMyXHU2N0QzXHU2OEMwXHU2RDRCXHVGRjA5XG4gICAgICAgIGNvbnN0IHJlcG9ydCA9IGF3YWl0IHRoaXMuY2FwdHVyZURpYWdub3N0aWNzKCk7XG4gICAgICAgIHJlc3VsdC5kaWFnbm9zdGljcyA9IFtcbiAgICAgICAgICAuLi5yZXBvcnQuY29uc29sZSxcbiAgICAgICAgICAuLi5yZXBvcnQubmV0d29yayxcbiAgICAgICAgICAuLi5yZXBvcnQuZG9tLFxuICAgICAgICAgIC4uLnJlcG9ydC5qc0V4Y2VwdGlvbnMsXG4gICAgICAgICAgLi4ucmVwb3J0LnBlcmZvcm1hbmNlLFxuICAgICAgICBdLnNsaWNlKDAsIDEwKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2Vzc2lvbi5zZXRFcnJvcihtZXNzYWdlKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgLyoqIFx1ODNCN1x1NTNENlx1OTg3NVx1OTc2Mlx1NUZFQlx1NzE2N1x1RkYwOFx1NEY5QiBBSSBcdTg5QzJcdTVCREZcdTk4NzVcdTk3NjJcdUZGMDkgKi9cbiAgYXN5bmMgb2JzZXJ2ZShvcHRzPzogU25hcHNob3RPcHRpb25zKTogUHJvbWlzZTxQYWdlU25hcHNob3Q+IHtcbiAgICB0aGlzLnNlc3Npb24udHJhbnNpdGlvbihcIm9ic2VydmluZ1wiKTtcbiAgICBjb25zdCBzbmFwID0gYXdhaXQgdGhpcy5lbmdpbmUuc25hcHNob3Qob3B0cyA/PyB0aGlzLm9wdHMuc25hcHNob3RPcHRpb25zKTtcbiAgICB0aGlzLnNlc3Npb24udHJhbnNpdGlvbihcIm9ic2VydmluZ1wiLCB7IGxhc3RTbmFwc2hvdFJlZjogYCR7c25hcC51cmx9IyR7c25hcC50aW1lc3RhbXB9YCB9KTtcbiAgICByZXR1cm4gc25hcDtcbiAgfVxuXG4gIC8qKiBcdTkxQzdcdTk2QzZcdTUxNjhcdTkxQ0ZcdThDMDNcdThCRDVcdThCQ0FcdTY1QURcdUZGMDg1IFx1NjYxRlx1ODBGRFx1NTI5Qlx1NjgzOFx1NUZDM1x1RkYwOSAqL1xuICBhc3luYyBjYXB0dXJlRGlhZ25vc3RpY3MoKTogUHJvbWlzZTxEaWFnbm9zdGljUmVwb3J0PiB7XG4gICAgdGhpcy5zZXNzaW9uLnRyYW5zaXRpb24oXCJkaWFnbm9zaW5nXCIpO1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMuZW5naW5lLmRpYWdub3NlKCk7XG4gICAgLy8gXHU1RjUyXHU0RTAwXHU1MzE2XHVGRjFBXHU1QkY5XHU3RjNBXHU1OTMxXHU3Njg0IGRvbS9hY2Nlc3NpYmlsaXR5IFx1NUI1N1x1NkJCNVx1NTE1Q1x1NUU5NVx1RkYwQ1x1NTE3Q1x1NUJCOVx1NjVFN1x1NUYxNVx1NjRDRVx1OEZENFx1NTZERVx1NzY4NCA0IFx1NUI1N1x1NkJCNVx1N0VEM1x1Njc4NFxuICAgIHRoaXMuZGlhZ25vc3RpY3NDYWNoZSA9IHtcbiAgICAgIGNvbnNvbGU6IHJhdy5jb25zb2xlID8/IFtdLFxuICAgICAgbmV0d29yazogcmF3Lm5ldHdvcmsgPz8gW10sXG4gICAgICBkb206IHJhdy5kb20gPz8gW10sXG4gICAgICBwZXJmb3JtYW5jZTogcmF3LnBlcmZvcm1hbmNlID8/IFtdLFxuICAgICAganNFeGNlcHRpb25zOiByYXcuanNFeGNlcHRpb25zID8/IFtdLFxuICAgICAgYWNjZXNzaWJpbGl0eTogcmF3LmFjY2Vzc2liaWxpdHkgPz8gW10sXG4gICAgfTtcbiAgICB0aGlzLnNlc3Npb24udHJhbnNpdGlvbihcImFjdGluZ1wiKTtcbiAgICByZXR1cm4gdGhpcy5kaWFnbm9zdGljc0NhY2hlO1xuICB9XG5cbiAgLyoqIFx1NjcwMFx1OEZEMVx1NEUwMFx1NkIyMVx1OEJDQVx1NjVBRFx1NjJBNVx1NTQ0QSAqL1xuICBnZXQgbGFzdERpYWdub3N0aWNzKCk6IERpYWdub3N0aWNSZXBvcnQge1xuICAgIHJldHVybiB0aGlzLmRpYWdub3N0aWNzQ2FjaGU7XG4gIH1cblxuICAvKiogXHU2Q0U4XHU1MTY1XHU2MjY3XHU4ODRDIEpTXHVGRjA4XHU5QUQ4XHU3RUE3XHU4QkNBXHU2NUFEL1x1OEJDNFx1NEYzMFx1RkYwOSAqL1xuICBhc3luYyBldmFsKHNjcmlwdDogc3RyaW5nKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgcmV0dXJuIHRoaXMuZW5naW5lLmV2YWx1YXRlKHNjcmlwdCk7XG4gIH1cbn1cbiIsICIvKipcbiAqIFx1NTE0M1x1N0QyMFx1NUI5QVx1NEY0RFx1NTY2OFx1RkYxQVx1NTkxQVx1N0I1Nlx1NzU2NVx1NUI5QVx1NEY0RFxuICpcbiAqIFx1NTAxRlx1OTI3NFx1RkYxQVxuICogLSBTdGFnZWhhbmRcdUZGMUFDU1MgXHU5MDA5XHU2MkU5XHU1NjY4XHUzMDAxWFBhdGhcdTMwMDFBSSBMb2NhdG9yXHUzMDAxXHU2NTg3XHU2NzJDXHU1QjlBXHU0RjREXG4gKiAtIEJyb3dzZXItVXNlXHVGRjFBXHU4QkVEXHU0RTQ5L1x1NjU4N1x1NjcyQ1x1NUI5QVx1NEY0RFxuICogLSBEZXZUb29scyBNQ1BcdUZGMUFcdTkwMUFcdThGQzcgcmVmIFx1N0NCRVx1Nzg2RVx1NUJGQlx1NTc0MFxuICpcbiAqIFx1NUI5QVx1NEY0RFx1NEYxOFx1NTE0OFx1N0VBN1x1RkYxQXJlZlx1RkYwOFx1NUZFQlx1NzE2N1x1NUYxNVx1NzUyOFx1RkYwOSA+IHNlbGVjdG9yID4gdGV4dCA+IHNlbWFudGljID4gaW50ZW50XG4gKi9cbmltcG9ydCB0eXBlIHsgUGFnZSB9IGZyb20gXCJwbGF5d3JpZ2h0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9jYXRlT3B0aW9ucyB7XG4gIC8qKiBcdTVGRUJcdTcxNjdcdTVGMTVcdTc1MjggKi9cbiAgcmVmPzogc3RyaW5nO1xuICAvKiogQ1NTIFx1OTAwOVx1NjJFOVx1NTY2OCAqL1xuICBzZWxlY3Rvcj86IHN0cmluZztcbiAgLyoqIFx1N0NCRVx1Nzg2RVx1NjU4N1x1NjcyQyAqL1xuICB0ZXh0Pzogc3RyaW5nO1xuICAvKiogXHU4QkVEXHU0RTQ5XHU2M0NGXHU4RkYwXHVGRjA4XHU4MUVBXHU3MTM2XHU4QkVEXHU4QTAwXHVGRjBDXHU2NzAwXHU3RUM4XHU1NkRFXHU5MDAwXHU1MjMwIEFJIFx1ODlFM1x1Njc5MFx1RkYwOSAqL1xuICBzZW1hbnRpYz86IHN0cmluZztcbiAgLyoqIFx1OEQ4NVx1NjVGNiAqL1xuICB0aW1lb3V0TXM/OiBudW1iZXI7XG59XG5cbi8qKiBcdTVCOUFcdTRGNERcdTdFRDNcdTY3OUNcdUZGMUFcdThGRDRcdTU2REVcdTUzRUZcdTY0Q0RcdTRGNUNcdTc2ODQgbG9jYXRvciBcdTRFMEVcdTUxNzZcdTYzQ0ZcdThGRjAgKi9cbmV4cG9ydCBpbnRlcmZhY2UgTG9jYXRlZCB7XG4gIGxvY2F0b3I6IGltcG9ydChcInBsYXl3cmlnaHRcIikuTG9jYXRvcjtcbiAgLyoqIFx1NUI5QVx1NEY0RFx1NjVCOVx1NUYwRlx1OEJGNFx1NjYwRVx1RkYwOFx1NEY5Qlx1NjVFNVx1NUZENy9cdThCQ0FcdTY1QURcdUZGMDkgKi9cbiAgc3RyYXRlZ3k6IFwicmVmXCIgfCBcInNlbGVjdG9yXCIgfCBcInRleHRcIiB8IFwic2VtYW50aWNcIjtcbiAgLyoqIFx1NzUyOFx1NEU4RVx1N0NCRVx1Nzg2RVx1OTUxQVx1NUI5QVx1NzY4NFx1NTUyRlx1NEUwMCBDU1MgXHU5MDA5XHU2MkU5XHU1NjY4XHVGRjA4XHU0RjlCXHU1NDBFXHU3RUVEXHU4QkNBXHU2NUFEL1x1OTFDRFx1OEJENVx1RkYwOSAqL1xuICBhbmNob3JTZWxlY3Rvcjogc3RyaW5nO1xufVxuXG4vKipcbiAqIFx1OEJFRFx1NEU0OVx1ODlFM1x1Njc5MFx1NTY2OFx1NTZERVx1OEMwM1x1RkYxQVx1NjI4QVx1ODFFQVx1NzEzNlx1OEJFRFx1OEEwMFx1OEJFRFx1NEU0OVx1NjNDRlx1OEZGMFx1ODlFM1x1Njc5MFx1NEUzQVx1NTNFRlx1NUI5QVx1NEY0RFx1NTNDMlx1NjU3MFx1MzAwMlxuICogXHU3NTMxXHU1RjE1XHU2NENFXHU1NzI4XHU1MjFEXHU1OUNCXHU1MzE2XHU2NUY2XHU2Q0U4XHU1MTY1XHVGRjA4XHU5MDFBXHU1RTM4XHU1N0ZBXHU0RThFIGFpLWxheWVyIFx1NzY4NFx1OEJFRFx1NEU0OVx1NUI5QVx1NEY0RFx1NTY2OFx1RkYwQ1x1N0VEM1x1NTQwOFx1NUZFQlx1NzE2N1x1NTA1QVxuICogXHU0RTJEXHU2NTg3XHU1MjA2XHU4QkNEL1x1OEJFRFx1NEU0OVx1NzZGOFx1NEYzQ1x1NUVBNlx1NTMzOVx1OTE0RFx1RkYwOVx1RkYwQ1x1NEVDRVx1ODAwQ1x1NjI1M1x1OTAxQVx1MzAwQ0FJIFx1OEJFRFx1NEU0OVx1NUM0MiBcdTIxOTIgXHU1RjE1XHU2NENFXHU3Q0JFXHU3ODZFXHU1QjlBXHU0RjREXHUzMDBEXHU3Njg0XHU5NEZFXHU4REVGXHUzMDAyXG4gKiBcdThGRDRcdTU2REUgbnVsbCBcdTg4NjhcdTc5M0FcdTY3MkFcdTU0N0RcdTRFMkRcdTMwMDJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZW1hbnRpY1Jlc29sdmVyIHtcbiAgcmVzb2x2ZShzZW1hbnRpYzogc3RyaW5nKTogUHJvbWlzZTx7IHJlZj86IHN0cmluZzsgdGV4dD86IHN0cmluZzsgc2VsZWN0b3I/OiBzdHJpbmcgfSB8IG51bGw+O1xufVxuXG5jb25zdCBJTlRFUkFDVElWRV9TRUxFQ1RPUiA9IFtcbiAgXCJhW2hyZWZdXCIsXG4gIFwiYnV0dG9uXCIsXG4gIFwiaW5wdXQ6bm90KFt0eXBlPSdoaWRkZW4nXSlcIixcbiAgXCJzZWxlY3RcIixcbiAgXCJ0ZXh0YXJlYVwiLFxuICBcIltyb2xlPSdidXR0b24nXVwiLFxuICBcIltyb2xlPSdsaW5rJ11cIixcbiAgXCJbY29udGVudGVkaXRhYmxlPSd0cnVlJ11cIixcbiAgXCJsYWJlbFwiLFxuXS5qb2luKFwiLCBcIik7XG5cbmV4cG9ydCBjbGFzcyBFbGVtZW50TG9jYXRvciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcGFnZTogUGFnZSwgcHJpdmF0ZSBzZW1hbnRpY1Jlc29sdmVyPzogU2VtYW50aWNSZXNvbHZlcikge31cblxuICAvKipcbiAgICogXHU2ODM5XHU2MzZFXHU1MkE4XHU0RjVDXHU1M0MyXHU2NTcwXHU1QjlBXHU0RjREXHU1MTQzXHU3RDIwXHVGRjBDXHU1OTFBXHU3QjU2XHU3NTY1XHU0RjlEXHU2QjIxXHU1NkRFXHU5MDAwXHUzMDAyXG4gICAqIFx1NjI3RVx1NEUwRFx1NTIzMFx1NjVGNlx1NjI5Qlx1NTFGQVx1NUUyNlx1OEJDQVx1NjVBRFx1NjNEMFx1NzkzQVx1NzY4NFx1OTUxOVx1OEJFRlx1MzAwMlxuICAgKi9cbiAgYXN5bmMgbG9jYXRlKG9wdHM6IExvY2F0ZU9wdGlvbnMpOiBQcm9taXNlPExvY2F0ZWQ+IHtcbiAgICBjb25zdCB7IHJlZiwgc2VsZWN0b3IsIHRleHQsIHNlbWFudGljIH0gPSBvcHRzO1xuXG4gICAgLy8gMSkgcmVmIFx1NUI5QVx1NEY0RFx1RkYwOFx1NjcwMFx1OUFEOFx1NjU0OFx1MzAwMVx1NjcwMFx1N0NCRVx1Nzg2RVx1RkYwQ1x1Njc2NVx1ODFFQVx1NUZFQlx1NzE2N1x1NEVBNFx1NEU5Mlx1N0QyMlx1NUYxNVx1RkYwOVxuICAgIGlmIChyZWYpIHtcbiAgICAgIGNvbnN0IGJ5UmVmID0gdGhpcy5sb2NhdGVCeVJlZihyZWYpO1xuICAgICAgaWYgKChhd2FpdCBieVJlZi5jb3VudCgpKSkge1xuICAgICAgICByZXR1cm4geyBsb2NhdG9yOiBieVJlZi5maXJzdCgpLCBzdHJhdGVneTogXCJyZWZcIiwgYW5jaG9yU2VsZWN0b3I6IGF3YWl0IHRoaXMudG9Dc3MoYnlSZWYuZmlyc3QoKSkgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAyKSBDU1MgXHU5MDA5XHU2MkU5XHU1NjY4XG4gICAgaWYgKHNlbGVjdG9yKSB7XG4gICAgICBjb25zdCBsb2MgPSB0aGlzLnBhZ2UubG9jYXRvcihzZWxlY3Rvcik7XG4gICAgICBpZiAoKGF3YWl0IGxvYy5jb3VudCgpKSkge1xuICAgICAgICByZXR1cm4geyBsb2NhdG9yOiBsb2MuZmlyc3QoKSwgc3RyYXRlZ3k6IFwic2VsZWN0b3JcIiwgYW5jaG9yU2VsZWN0b3I6IHNlbGVjdG9yIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gMykgXHU3Q0JFXHU3ODZFXHU2NTg3XHU2NzJDXHVGRjA4XHU1M0VGXHU0RUE0XHU0RTkyXHU1MTQzXHU3RDIwXHU1MTg1XHVGRjA5XG4gICAgaWYgKHRleHQpIHtcbiAgICAgIGNvbnN0IGJ5VGV4dCA9IHRoaXMubG9jYXRlQnlUZXh0KHRleHQpO1xuICAgICAgaWYgKChhd2FpdCBieVRleHQuY291bnQoKSkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBsb2NhdG9yOiBieVRleHQuZmlyc3QoKSxcbiAgICAgICAgICBzdHJhdGVneTogXCJ0ZXh0XCIsXG4gICAgICAgICAgYW5jaG9yU2VsZWN0b3I6IGF3YWl0IHRoaXMudG9Dc3MoYnlUZXh0LmZpcnN0KCkpLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIDQpIFx1OEJFRFx1NEU0OVx1NTZERVx1OTAwMFx1RkYxQVx1NUMxRFx1OEJENSByb2xlL25hbWUgXHU3RUM0XHU1NDA4XHVGRjBDXHU1MThEXHU3NTI4IGFpLWxheWVyIFx1OEJFRFx1NEU0OVx1NUI5QVx1NEY0RFx1NTY2OFx1RkYwOFx1NEUyRFx1NjU4N1x1NTIwNlx1OEJDRC9cdThCRURcdTRFNDlcdTc2RjhcdTRGM0NcdTVFQTZcdUZGMDlcbiAgICBpZiAoc2VtYW50aWMpIHtcbiAgICAgIGNvbnN0IGJ5U2VtYW50aWMgPSB0aGlzLmxvY2F0ZUJ5U2VtYW50aWMoc2VtYW50aWMpO1xuICAgICAgaWYgKChhd2FpdCBieVNlbWFudGljLmNvdW50KCkpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbG9jYXRvcjogYnlTZW1hbnRpYy5maXJzdCgpLFxuICAgICAgICAgIHN0cmF0ZWd5OiBcInNlbWFudGljXCIsXG4gICAgICAgICAgYW5jaG9yU2VsZWN0b3I6IGF3YWl0IHRoaXMudG9Dc3MoYnlTZW1hbnRpYy5maXJzdCgpKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIC8vIGFyaWEvcGxhY2Vob2xkZXIvdGl0bGUgXHU2NzJBXHU1NDdEXHU0RTJEIFx1MjE5MiBcdTRFQTRcdTdFRDlcdThCRURcdTRFNDlcdTVCOUFcdTRGNERcdTU2NjhcdUZGMDhcdTU3RkFcdTRFOEVcdTVGRUJcdTcxNjdcdTUwNUFcdThCRURcdTRFNDlcdTc2RjhcdTRGM0NcdTVFQTZcdTUzMzlcdTkxNERcdUZGMDlcbiAgICAgIGlmICh0aGlzLnNlbWFudGljUmVzb2x2ZXIpIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCB0aGlzLnNlbWFudGljUmVzb2x2ZXIucmVzb2x2ZShzZW1hbnRpYyk7XG4gICAgICAgIGlmIChyZXNvbHZlZD8ucmVmIHx8IHJlc29sdmVkPy5zZWxlY3RvciB8fCByZXNvbHZlZD8udGV4dCkge1xuICAgICAgICAgIGNvbnN0IGJ5UmVzb2x2ZWQgPSByZXNvbHZlZC5zZWxlY3RvclxuICAgICAgICAgICAgPyB0aGlzLnBhZ2UubG9jYXRvcihyZXNvbHZlZC5zZWxlY3RvcilcbiAgICAgICAgICAgIDogcmVzb2x2ZWQudGV4dFxuICAgICAgICAgICAgICA/IHRoaXMubG9jYXRlQnlUZXh0KHJlc29sdmVkLnRleHQpXG4gICAgICAgICAgICAgIDogdGhpcy5sb2NhdGVCeVJlZihyZXNvbHZlZC5yZWYhKTtcbiAgICAgICAgICBpZiAoKGF3YWl0IGJ5UmVzb2x2ZWQuY291bnQoKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGxvY2F0b3I6IGJ5UmVzb2x2ZWQuZmlyc3QoKSxcbiAgICAgICAgICAgICAgc3RyYXRlZ3k6IFwic2VtYW50aWNcIixcbiAgICAgICAgICAgICAgYW5jaG9yU2VsZWN0b3I6IHJlc29sdmVkLnNlbGVjdG9yIHx8IChhd2FpdCB0aGlzLnRvQ3NzKGJ5UmVzb2x2ZWQuZmlyc3QoKSkpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgXHU2NUUwXHU2Q0Q1XHU1QjlBXHU0RjREXHU1MTQzXHU3RDIwXHVGRjFBcmVmPSR7cmVmID8/IFwiLVwifSBzZWxlY3Rvcj0ke3NlbGVjdG9yID8/IFwiLVwifSB0ZXh0PSR7dGV4dCA/PyBcIi1cIn0gc2VtYW50aWM9JHtzZW1hbnRpYyA/PyBcIi1cIn0uIGAgK1xuICAgICAgICBgXHU1RUZBXHU4QkFFXHU4QzAzXHU3NTI4IG9ic2VydmUoKSBcdTgzQjdcdTUzRDZcdTY3MDBcdTY1QjBcdTVGRUJcdTcxNjdcdTU0MEVcdTkxQ0RcdThCRDVcdUZGMENcdTYyMTZcdTRGN0ZcdTc1MjggZGlhZ25vc2UoKSBcdTY4QzBcdTY3RTUgRE9NIFx1NzJCNlx1NjAwMVx1MzAwMmBcbiAgICApO1xuICB9XG5cbiAgLyoqIFx1OTAxQVx1OEZDN1x1NUZFQlx1NzE2NyByZWYgXHU1QjlBXHU0RjREXHVGRjFBcmVmIFx1NTE4NVx1NUQ0Q1x1NEU4Nlx1OTAwOVx1NjJFOVx1NTY2OFx1NEZFMVx1NjA2Rlx1RkYwOGRhdGEtZm9yZ2UtcmVmXHVGRjA5ICovXG4gIHByaXZhdGUgbG9jYXRlQnlSZWYocmVmOiBzdHJpbmcpOiBpbXBvcnQoXCJwbGF5d3JpZ2h0XCIpLkxvY2F0b3Ige1xuICAgIC8vIFx1NEYxOFx1NTE0OFx1N0NCRVx1Nzg2RVx1NTMzOVx1OTE0RCBkYXRhLWZvcmdlLXJlZiBcdTVDNUVcdTYwMjdcdUZGMENcdTgyRTVcdTY3MkFcdTU0N0RcdTRFMkRcdTUyMTlcdTc1MjhcdTZBMjFcdTdDQ0FcdTUzMzlcdTkxNERcbiAgICByZXR1cm4gdGhpcy5wYWdlLmxvY2F0b3IoYFtkYXRhLWZvcmdlLXJlZj1cIiR7cmVmfVwiXSwgW2RhdGEtZm9yZ2UtcmVmKj1cIiR7cmVmfVwiXWApO1xuICB9XG5cbiAgLyoqIFx1NjU4N1x1NjcyQ1x1NUI5QVx1NEY0RFx1RkYxQVx1NTcyOFx1NTNFRlx1NEVBNFx1NEU5Mlx1NTE0M1x1N0QyMFx1NTE4NVx1NjdFNVx1NjI3RVx1NTMwNVx1NTQyQlx1NjMwN1x1NUI5QVx1NjU4N1x1NjcyQ1x1ODAwNSAqL1xuICBwcml2YXRlIGxvY2F0ZUJ5VGV4dCh0ZXh0OiBzdHJpbmcpOiBpbXBvcnQoXCJwbGF5d3JpZ2h0XCIpLkxvY2F0b3Ige1xuICAgIHJldHVybiB0aGlzLnBhZ2UubG9jYXRvcihJTlRFUkFDVElWRV9TRUxFQ1RPUikuZmlsdGVyKHsgaGFzVGV4dDogdGV4dCB9KTtcbiAgfVxuXG4gIC8qKiBcdThCRURcdTRFNDlcdTVCOUFcdTRGNERcdUZGMUFcdTVDMURcdThCRDUgYXJpYS1sYWJlbCAvIHBsYWNlaG9sZGVyIC8gdGl0bGUgKi9cbiAgcHJpdmF0ZSBsb2NhdGVCeVNlbWFudGljKHNlbWFudGljOiBzdHJpbmcpOiBpbXBvcnQoXCJwbGF5d3JpZ2h0XCIpLkxvY2F0b3Ige1xuICAgIHJldHVybiB0aGlzLnBhZ2VcbiAgICAgIC5sb2NhdG9yKGAke0lOVEVSQUNUSVZFX1NFTEVDVE9SfVthcmlhLWxhYmVsKj1cIiR7c2VtYW50aWN9XCJdLCAke0lOVEVSQUNUSVZFX1NFTEVDVE9SfVtwbGFjZWhvbGRlcio9XCIke3NlbWFudGljfVwiXSwgJHtJTlRFUkFDVElWRV9TRUxFQ1RPUn1bdGl0bGUqPVwiJHtzZW1hbnRpY31cIl1gKVxuICAgICAgLmZpcnN0KCk7XG4gIH1cblxuICAvKiogXHU1QzA2IGxvY2F0b3IgXHU4RjZDXHU2MjEwXHU1NTJGXHU0RTAwIENTUyBcdTkwMDlcdTYyRTlcdTU2NjhcdUZGMDhcdTc1MjhcdTRFOEVcdThCQ0FcdTY1QURcdTk1MUFcdTVCOUFcdUZGMDkgKi9cbiAgcHJpdmF0ZSBhc3luYyB0b0Nzcyhsb2M6IGltcG9ydChcInBsYXl3cmlnaHRcIikuTG9jYXRvcik6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiAoYXdhaXQgbG9jLmV2YWx1YXRlKChlbDogRWxlbWVudCkgPT4ge1xuICAgICAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgbGV0IGN1cjogRWxlbWVudCB8IG51bGwgPSBlbDtcbiAgICAgICAgd2hpbGUgKGN1ciAmJiBjdXIubm9kZVR5cGUgPT09IDEgJiYgcGFydHMubGVuZ3RoIDwgNSkge1xuICAgICAgICAgIGxldCBzZWcgPSBjdXIudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIGlmIChjdXIuaWQpIHtcbiAgICAgICAgICAgIHNlZyArPSBgIyR7Y3VyLmlkfWA7XG4gICAgICAgICAgICBwYXJ0cy51bnNoaWZ0KHNlZyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGN1ci5jbGFzc0xpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICBzZWcgKz0gXCIuXCIgKyBBcnJheS5mcm9tKGN1ci5jbGFzc0xpc3QpLnNsaWNlKDAsIDIpLmpvaW4oXCIuXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJ0cy51bnNoaWZ0KHNlZyk7XG4gICAgICAgICAgY3VyID0gY3VyLnBhcmVudEVsZW1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhcnRzLmpvaW4oXCIgPiBcIik7XG4gICAgICB9KSkgYXMgc3RyaW5nO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfVxuICB9XG59XG4iLCAiLyoqXG4gKiBcdTk4NzVcdTk3NjJcdTVGRUJcdTcxNjdcdTc1MUZcdTYyMTBcdTU2NjhcbiAqXG4gKiBcdTUwMUZcdTkyNzQgQ2hyb21lIERldlRvb2xzIE1DUCBcdTc2ODQgVG9rZW4gXHU5QUQ4XHU2NTQ4XHU3QjU2XHU3NTY1XHVGRjFBXG4gKiAtIFx1NUM1RVx1NjAyN1x1NzY3RFx1NTQwRFx1NTM1NVx1ODhDMVx1NTI2QVx1RkYwOFx1OTA3Rlx1NTE0RFx1NTE2OFx1OTFDRlx1NUM1RVx1NjAyN1x1NzIwNlx1NzBCOFx1RkYwOVxuICogLSBcdTgyODJcdTcwQjlcdTY1NzBcdTRFMEFcdTk2NTAgKyBcdTZERjFcdTVFQTZcdTg4QzFcdTUyNkFcbiAqIC0gXHU2NTg3XHU2NzJDXHU5NTdGXHU1RUE2XHU4OEMxXHU1MjZBXG4gKiAtIFx1NzUxRlx1NjIxMFx1NTNFRlx1NEVBNFx1NEU5Mlx1NTE0M1x1N0QyMFx1N0QyMlx1NUYxNVx1RkYwOFx1NEY5QiBBSSBcdTYzMTFcdTkwMDkgcmVmXHVGRjA5XG4gKiAtIFx1NEUzQVx1NEVBNFx1NEU5Mlx1NTE0M1x1N0QyMFx1NzUxRlx1NjIxMFx1N0EzM1x1NUI5QSBkYXRhLWZvcmdlLXJlZiBcdTRGQkZcdTRFOEVcdTdDQkVcdTc4NkVcdTVCOUFcdTRGNERcbiAqL1xuaW1wb3J0IHR5cGUgeyBQYWdlIH0gZnJvbSBcInBsYXl3cmlnaHRcIjtcbmltcG9ydCB0eXBlIHsgUGFnZVNuYXBzaG90LCBTbmFwc2hvdE5vZGUsIFNuYXBzaG90T3B0aW9ucyB9IGZyb20gXCJAb3BlbmxpdWxhbi9jb3JlXCI7XG5cbmNvbnN0IEFUVFJfV0hJVEVMSVNUID0gW1wiaWRcIiwgXCJjbGFzc1wiLCBcIm5hbWVcIiwgXCJ0eXBlXCIsIFwidmFsdWVcIiwgXCJocmVmXCIsIFwicGxhY2Vob2xkZXJcIiwgXCJ0aXRsZVwiLCBcImFyaWEtbGFiZWxcIiwgXCJyb2xlXCIsIFwiZGF0YS10ZXN0aWRcIiwgXCJzcmNcIiwgXCJhbHRcIiwgXCJjaGVja2VkXCIsIFwic2VsZWN0ZWRcIiwgXCJkaXNhYmxlZFwiLCBcInRhcmdldFwiXTtcbmNvbnN0IFRFWFRfVEFHUyA9IG5ldyBTZXQoW1wiUFwiLCBcIkgxXCIsIFwiSDJcIiwgXCJIM1wiLCBcIkg0XCIsIFwiSDVcIiwgXCJINlwiLCBcIkFcIiwgXCJCVVRUT05cIiwgXCJJTlBVVFwiLCBcIlRFWFRBUkVBXCIsIFwiU0VMRUNUXCIsIFwiT1BUSU9OXCIsIFwiTElcIiwgXCJURFwiLCBcIlRIXCIsIFwiU1BBTlwiLCBcIkxBQkVMXCIsIFwiQ0FQVElPTlwiLCBcIlNVTU1BUllcIl0pO1xuY29uc3QgUFJVTkVfVEFHUyA9IG5ldyBTZXQoW1wiU0NSSVBUXCIsIFwiU1RZTEVcIiwgXCJOT1NDUklQVFwiLCBcIlRFTVBMQVRFXCIsIFwiSUZSQU1FXCIsIFwiSEVBRFwiLCBcIk1FVEFcIiwgXCJMSU5LXCIsIFwiU1ZHXCJdKTtcbmNvbnN0IElOVEVSQUNUSVZFX1RBR1MgPSBuZXcgU2V0KFtcIkFcIiwgXCJCVVRUT05cIiwgXCJJTlBVVFwiLCBcIlNFTEVDVFwiLCBcIlRFWFRBUkVBXCIsIFwiT1BUSU9OXCIsIFwiU1VNTUFSWVwiXSk7XG5jb25zdCBJTlRFUkFDVElWRV9ST0xFUyA9IG5ldyBTZXQoW1wiYnV0dG9uXCIsIFwibGlua1wiLCBcInRleHRib3hcIiwgXCJjb21ib2JveFwiLCBcImNoZWNrYm94XCIsIFwicmFkaW9cIiwgXCJ0YWJcIiwgXCJtZW51aXRlbVwiXSk7XG5cbmV4cG9ydCBjbGFzcyBTbmFwc2hvdEJ1aWxkZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBhZ2U6IFBhZ2UpIHt9XG5cbiAgYXN5bmMgYnVpbGQob3B0czogU25hcHNob3RPcHRpb25zID0ge30pOiBQcm9taXNlPFBhZ2VTbmFwc2hvdD4ge1xuICAgIGNvbnN0IG1heE5vZGVzID0gb3B0cy5tYXhOb2RlcyA/PyAyMDA7XG4gICAgY29uc3QgbWF4VGV4dCA9IG9wdHMubWF4VGV4dExlbmd0aCA/PyA4MDtcbiAgICBjb25zdCB3aXRoU2VsZWN0b3JzID0gb3B0cy53aXRoU2VsZWN0b3JzID8/IHRydWU7XG5cbiAgICAvLyBcdTZDRThcdTUxNjVcdThGODVcdTUyQTlcdTgxMUFcdTY3MkNcdUZGMENcdTZENEZcdTg5QzhcdTU2NjhcdTdBRUZcdTg4QzFcdTUyNkFcdTkwNERcdTUzODYgRE9NXHVGRjA4XHU2QkQ0IE5vZGUgXHU3QUVGXHU5MDEwXHU4MjgyXHU3MEI5XHU2NkY0XHU5QUQ4XHU2NTQ4XHVGRjA5XG4gICAgLy8gXHU2Q0U4XHU2MTBGXHVGRjFBbm9kZSBcdTZBMjFcdTU3NTdcdTRGNUNcdTc1MjhcdTU3REZcdTVFMzhcdTkxQ0ZcdUZGMDhQUlVORV9UQUdTL1RFWFRfVEFHUy9JTlRFUkFDVElWRV9ST0xFUy93aXRoU2VsZWN0b3JzIFx1N0I0OVx1RkYwOVxuICAgIC8vIFx1NTcyOCBwYWdlLmV2YWx1YXRlIFx1NzY4NFx1NkQ0Rlx1ODlDOFx1NTY2OFx1NjI2N1x1ODg0Q1x1NEUwQVx1NEUwQlx1NjU4N1x1NEUyRFx1NEUwRFx1NTNFRlx1ODlDMVx1RkYwQ1x1NEUxNCBTZXQgXHU2NUUwXHU2Q0Q1XHU5MDFBXHU4RkM3XHU1RThGXHU1MjE3XHU1MzE2XHU0RkREXHU3NTU5XHVGRjBDXG4gICAgLy8gXHU1NkUwXHU2QjY0XHU1RkM1XHU5ODdCXHU0RjVDXHU0RTNBXHU2NTcwXHU3RUM0XHU1M0MyXHU2NTcwXHU2NjNFXHU1RjBGXHU0RjIwXHU1MTY1XHU1RTc2XHU1NzI4XHU2RDRGXHU4OUM4XHU1NjY4XHU3QUVGXHU3NTI4IC5pbmNsdWRlcygpIFx1NTIyNFx1NjVBRFx1RkYwQ1xuICAgIC8vIFx1NTQyNlx1NTIxOVx1NzcxRlx1NUI5RVx1NkQ0Rlx1ODlDOFx1NTY2OFx1NEUyRFx1NEYxQVx1NjI5QiBSZWZlcmVuY2VFcnJvciAvIFR5cGVFcnJvclx1RkYwOFx1OEZEOVx1NkI2M1x1NjYyRlx1NTM1NVx1NkQ0Qlx1NTNEMVx1NzNCMFx1NEUwRFx1NEU4Nlx1NzY4NFx1OEZEMFx1ODg0Q1x1NjcxRlx1N0YzQVx1OTY3N1x1RkYwOVx1MzAwMlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucGFnZS5ldmFsdWF0ZShcbiAgICAgICh7IG1heE5vZGVzLCBtYXhUZXh0LCBwcnVuZURlZXAsIGluY2x1ZGVIaWRkZW4sIHdpdGhTZWxlY3RvcnMsIFBSVU5FX1RBR1MsIFRFWFRfVEFHUywgQVRUUl9XSElURUxJU1QsIElOVEVSQUNUSVZFX1RBR1MsIElOVEVSQUNUSVZFX1JPTEVTIH0pID0+IHtcbiAgICAgICAgY29uc3Qgb3V0OiB7XG4gICAgICAgICAgdXJsOiBzdHJpbmc7XG4gICAgICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgICAgICByZWFkeVN0YXRlOiBzdHJpbmc7XG4gICAgICAgICAgdG90YWxOb2RlczogbnVtYmVyO1xuICAgICAgICAgIHJvb3Q6IGFueTtcbiAgICAgICAgICBpbnRlcmFjdGl2ZTogYW55W107XG4gICAgICAgIH0gPSB7XG4gICAgICAgICAgdXJsOiBsb2NhdGlvbi5ocmVmLFxuICAgICAgICAgIHRpdGxlOiBkb2N1bWVudC50aXRsZSxcbiAgICAgICAgICByZWFkeVN0YXRlOiBkb2N1bWVudC5yZWFkeVN0YXRlLFxuICAgICAgICAgIHRvdGFsTm9kZXM6IDAsXG4gICAgICAgICAgcm9vdDogbnVsbCBhcyBhbnksXG4gICAgICAgICAgaW50ZXJhY3RpdmU6IFtdLFxuICAgICAgICB9O1xuXG4gICAgICAgIGxldCBlbWl0dGVkID0gMDtcbiAgICAgICAgbGV0IHRydW5jYXRlZE5vZGVzID0gMDtcbiAgICAgICAgY29uc3QgcmVmQ291bnRlciA9IHsgbjogMCB9O1xuXG4gICAgICAgIGNvbnN0IGlzVmlzaWJsZSA9IChlbDogRWxlbWVudCk6IGJvb2xlYW4gPT4ge1xuICAgICAgICAgIGNvbnN0IHIgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgICBjb25zdCBzID0gZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgICAgICAgcmV0dXJuIHMuZGlzcGxheSAhPT0gXCJub25lXCIgJiYgcy52aXNpYmlsaXR5ICE9PSBcImhpZGRlblwiICYmIHIud2lkdGggPiAwICYmIHIuaGVpZ2h0ID4gMDtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBpc0ludGVyYWN0aXZlID0gKGVsOiBFbGVtZW50KTogYm9vbGVhbiA9PiB7XG4gICAgICAgICAgaWYgKElOVEVSQUNUSVZFX1RBR1MuaW5jbHVkZXMoZWwudGFnTmFtZSkpIHJldHVybiB0cnVlO1xuICAgICAgICAgIGNvbnN0IHJvbGUgPSBlbC5nZXRBdHRyaWJ1dGUoXCJyb2xlXCIpO1xuICAgICAgICAgIHJldHVybiAhIXJvbGUgJiYgSU5URVJBQ1RJVkVfUk9MRVMuaW5jbHVkZXMocm9sZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gXHU2NTRGXHU2MTFGXHU4RjkzXHU1MTY1XHU3QzdCXHU1NzhCXHVGRjA4XHU1QkM2XHU3ODAxL1x1NEVFNFx1NzI0Qy9cdTVCQzZcdTk0QTVcdTdCNDlcdUZGMDlcdTIwMTRcdTIwMTQgXHU1MDNDXHU1RkM1XHU5ODdCXHU4MTMxXHU2NTRGXHVGRjBDXHU5NjMyXHU0RUU0XHU3MjRDL1x1NTNFM1x1NEVFNFx1NkNDNFx1OTczMlxuICAgICAgICBjb25zdCBTRU5TSVRJVkVfSU5QVVRfVFlQRVMgPSBbXCJwYXNzd29yZFwiLCBcInRva2VuXCIsIFwic2VjcmV0XCIsIFwia2V5XCIsIFwiYXBpLWtleVwiLCBcImFwaWtleVwiXTtcbiAgICAgICAgY29uc3QgaXNTZW5zaXRpdmVJbnB1dCA9IChlbDogRWxlbWVudCk6IGJvb2xlYW4gPT4ge1xuICAgICAgICAgIGlmIChlbC50YWdOYW1lICE9PSBcIklOUFVUXCIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBjb25zdCB0ID0gKGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnR5cGU/LnRvTG93ZXJDYXNlKCkgPz8gXCJcIjtcbiAgICAgICAgICBjb25zdCBuID0gKChlbC5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpIHx8IFwiXCIpICsgKGVsLmdldEF0dHJpYnV0ZShcImF1dG9jb21wbGV0ZVwiKSB8fCBcIlwiKSkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICBpZiAodCA9PT0gXCJwYXNzd29yZFwiKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICBpZiAoU0VOU0lUSVZFX0lOUFVUX1RZUEVTLmluY2x1ZGVzKHQpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICByZXR1cm4gLyhwYXNzd29yZHxwYXNzd2R8dG9rZW58c2VjcmV0fGFwaVtfLV0/a2V5fGF1dGgpLy50ZXN0KG4pO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBlbFRleHQgPSAoZWw6IEVsZW1lbnQpOiBzdHJpbmcgPT4ge1xuICAgICAgICAgIGlmIChlbC50YWdOYW1lID09PSBcIklOUFVUXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IHBoID0gZWwuZ2V0QXR0cmlidXRlKFwicGxhY2Vob2xkZXJcIikgfHwgXCJcIjtcbiAgICAgICAgICAgIC8vIFx1NjU0Rlx1NjExRlx1OEY5M1x1NTE2NVx1Njg0Nlx1NEUwRFx1OEZENFx1NTZERVx1NzcxRlx1NUI5RVx1NTAzQ1x1RkYwQ1x1NEVDNVx1NzUyOFx1NTM2MFx1NEY0RFx1N0IyNlx1RkYwOFx1OTYzMlx1NEVFNFx1NzI0Qy9cdTVCQzZcdTc4MDFcdTUxNjVcdTVGRUJcdTcxNjdcdUZGMDlcbiAgICAgICAgICAgIGlmIChpc1NlbnNpdGl2ZUlucHV0KGVsKSkgcmV0dXJuIHBoID8gYFtcdTY1NEZcdTYxMUZcdThGOTNcdTUxNjVdICR7cGh9YCA6IFwiW1x1NjU0Rlx1NjExRlx1OEY5M1x1NTE2NVx1NURGMlx1OTY5MFx1ODVDRl1cIjtcbiAgICAgICAgICAgIGNvbnN0IHYgPSAoZWwgYXMgSFRNTElucHV0RWxlbWVudCkudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gdiB8fCBwaCB8fCBcIlwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZWwudGFnTmFtZSA9PT0gXCJTRUxFQ1RcIikge1xuICAgICAgICAgICAgY29uc3Qgc2VsID0gZWwgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XG4gICAgICAgICAgICByZXR1cm4gc2VsLnNlbGVjdGVkT3B0aW9uc1swXT8udGV4dCB8fCBcIlwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB0ID0gKGVsLnRleHRDb250ZW50IHx8IFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbiAgICAgICAgICByZXR1cm4gdC5zbGljZSgwLCBtYXhUZXh0KTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCB3YWxrID0gKGVsOiBFbGVtZW50LCBkZXB0aDogbnVtYmVyKTogYW55ID0+IHtcbiAgICAgICAgICBpZiAoZW1pdHRlZCA+PSBtYXhOb2Rlcykge1xuICAgICAgICAgICAgdHJ1bmNhdGVkTm9kZXMrKztcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoUFJVTkVfVEFHUy5pbmNsdWRlcyhlbC50YWdOYW1lKSkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgaWYgKCFpbmNsdWRlSGlkZGVuICYmICFpc1Zpc2libGUoZWwpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICBpZiAocHJ1bmVEZWVwICYmIGRlcHRoID4gMjUpIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgb3V0LnRvdGFsTm9kZXMrKztcbiAgICAgICAgICBlbWl0dGVkKys7XG5cbiAgICAgICAgICBjb25zdCBub2RlOiBhbnkgPSB7XG4gICAgICAgICAgICByZWY6IGByJHtyZWZDb3VudGVyLm4rK31gLFxuICAgICAgICAgICAgdGFnOiBlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCksXG4gICAgICAgICAgICB0ZXh0OiBURVhUX1RBR1MuaW5jbHVkZXMoZWwudGFnTmFtZSkgPyBlbFRleHQoZWwpIDogXCJcIixcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgICAgICAgICAgaW50ZXJhY3RpdmU6IGlzSW50ZXJhY3RpdmUoZWwpLFxuICAgICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBBVFRSX1dISVRFTElTVCkge1xuICAgICAgICAgICAgbGV0IHYgPSBlbC5nZXRBdHRyaWJ1dGUoYXR0cik7XG4gICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAvLyBcdTY1NEZcdTYxMUZcdThGOTNcdTUxNjVcdTY4NDZcdTc2ODQgdmFsdWUgXHU1QzVFXHU2MDI3XHU1RkM1XHU5ODdCXHU4MTMxXHU2NTRGXHVGRjA4XHU5NjMyXHU0RUU0XHU3MjRDL1x1NUJDNlx1NzgwMVx1NTE2NVx1NUZFQlx1NzE2N1x1RkYwOVxuICAgICAgICAgICAgICBpZiAoYXR0ciA9PT0gXCJ2YWx1ZVwiICYmIGlzU2Vuc2l0aXZlSW5wdXQoZWwpKSB7XG4gICAgICAgICAgICAgICAgdiA9IFwiKioqUkVEQUNURUQqKipcIjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBub2RlLmF0dHJpYnV0ZXNbYXR0cl0gPSB2LnNsaWNlKDAsIDYwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCByb2xlID0gZWwuZ2V0QXR0cmlidXRlKFwicm9sZVwiKTtcbiAgICAgICAgICBpZiAocm9sZSkgbm9kZS5yb2xlID0gcm9sZTtcbiAgICAgICAgICBpZiAod2l0aFNlbGVjdG9ycyAmJiAobm9kZS5pbnRlcmFjdGl2ZSB8fCBub2RlLmF0dHJpYnV0ZXMuaWQpKSB7XG4gICAgICAgICAgICAvLyBcdTc1MUZcdTYyMTBcdTdBMzNcdTVCOUEgcmVmIFx1NUM1RVx1NjAyN1x1NEZCRlx1NEU4RVx1NTQwRVx1N0VFRFx1NUI5QVx1NEY0RFxuICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlKFwiZGF0YS1mb3JnZS1yZWZcIiwgbm9kZS5yZWYpO1xuICAgICAgICAgICAgbm9kZS5zZWxlY3RvciA9IGVsLmlkXG4gICAgICAgICAgICAgID8gYCR7ZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpfSMke2VsLmlkfWBcbiAgICAgICAgICAgICAgOiBgJHtlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCl9W2RhdGEtZm9yZ2UtcmVmPVwiJHtub2RlLnJlZn1cIl1gO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub2RlLmludGVyYWN0aXZlKSB7XG4gICAgICAgICAgICBvdXQuaW50ZXJhY3RpdmUucHVzaCh7XG4gICAgICAgICAgICAgIHJlZjogbm9kZS5yZWYsXG4gICAgICAgICAgICAgIHRhZzogbm9kZS50YWcsXG4gICAgICAgICAgICAgIHRleHQ6IG5vZGUudGV4dCB8fCBlbFRleHQoZWwpLFxuICAgICAgICAgICAgICByb2xlOiByb2xlIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgc2VsZWN0b3I6IG5vZGUuc2VsZWN0b3IsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjaGlsZHJlbjogYW55W10gPSBbXTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIEFycmF5LmZyb20oZWwuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBjb25zdCBjID0gd2FsayhjaGlsZCwgZGVwdGggKyAxKTtcbiAgICAgICAgICAgIGlmIChjKSBjaGlsZHJlbi5wdXNoKGMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoKSBub2RlLmNoaWxkcmVuID0gY2hpbGRyZW47XG5cbiAgICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgICAgfTtcblxuICAgICAgICBvdXQucm9vdCA9IHdhbGsoZG9jdW1lbnQuYm9keSwgMCk7XG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBtYXhOb2RlcyxcbiAgICAgICAgbWF4VGV4dCxcbiAgICAgICAgcHJ1bmVEZWVwOiBvcHRzLnBydW5lRGVlcCA/PyB0cnVlLFxuICAgICAgICBpbmNsdWRlSGlkZGVuOiBvcHRzLmluY2x1ZGVIaWRkZW4gPz8gZmFsc2UsXG4gICAgICAgIHdpdGhTZWxlY3RvcnMsXG4gICAgICAgIFBSVU5FX1RBR1M6IFsuLi5QUlVORV9UQUdTXSxcbiAgICAgICAgVEVYVF9UQUdTOiBbLi4uVEVYVF9UQUdTXSxcbiAgICAgICAgQVRUUl9XSElURUxJU1Q6IFsuLi5BVFRSX1dISVRFTElTVF0sXG4gICAgICAgIElOVEVSQUNUSVZFX1RBR1M6IFsuLi5JTlRFUkFDVElWRV9UQUdTXSxcbiAgICAgICAgSU5URVJBQ1RJVkVfUk9MRVM6IFsuLi5JTlRFUkFDVElWRV9ST0xFU10sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFx1OEJBMVx1N0I5NyBUb2tlbiBcdTRGMzBcdTdCOTdcdUZGMDhcdTdFQTYgNCBcdTVCNTdcdTdCMjYvdG9rZW5cdUZGMENcdTU0MkJcdTdFRDNcdTY3ODRcdTVGMDBcdTk1MDBcdUZGMDlcbiAgICBjb25zdCBhcHByb3ggPSB0aGlzLmVzdGltYXRlVG9rZW5zKHJlc3VsdC5yb290KTtcblxuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHJlc3VsdC51cmwsXG4gICAgICB0aXRsZTogcmVzdWx0LnRpdGxlLFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICByZWFkeVN0YXRlOiByZXN1bHQucmVhZHlTdGF0ZSxcbiAgICAgIHN0YXRzOiB7XG4gICAgICAgIHRvdGFsTm9kZXM6IHJlc3VsdC50b3RhbE5vZGVzLFxuICAgICAgICBlbWl0dGVkTm9kZXM6IHJlc3VsdC50b3RhbE5vZGVzIC0gcmVzdWx0LmludGVyYWN0aXZlLmxlbmd0aCwgLy8gXHU4RkQxXHU0RjNDXG4gICAgICAgIHRydW5jYXRlZE5vZGVzOiAwLFxuICAgICAgICBhcHByb3hpbWF0ZVRva2VuczogYXBwcm94LFxuICAgICAgfSxcbiAgICAgIHJvb3Q6IHJlc3VsdC5yb290LFxuICAgICAgaW50ZXJhY3RpdmU6IHJlc3VsdC5pbnRlcmFjdGl2ZSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBlc3RpbWF0ZVRva2Vucyhyb290OiBhbnkpOiBudW1iZXIge1xuICAgIGxldCBjaGFycyA9IDA7XG4gICAgY29uc3QgY291bnQgPSAobjogYW55KSA9PiB7XG4gICAgICBpZiAoIW4pIHJldHVybjtcbiAgICAgIGNoYXJzICs9IChuLnRhZz8ubGVuZ3RoID8/IDApICsgKG4udGV4dD8ubGVuZ3RoID8/IDApICsgSlNPTi5zdHJpbmdpZnkobi5hdHRyaWJ1dGVzIHx8IHt9KS5sZW5ndGg7XG4gICAgICAobi5jaGlsZHJlbiB8fCBbXSkuZm9yRWFjaChjb3VudCk7XG4gICAgfTtcbiAgICBjb3VudChyb290KTtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChjaGFycyAvIDQpO1xuICB9XG59XG4iLCAiLyoqXG4gKiBQbGF5d3JpZ2h0IFx1NUYxNVx1NjRDRVx1NzY4NFx1OEJDQVx1NjVBRFx1OTFDN1x1OTZDNlx1NTY2OFxuICpcbiAqIFx1OTAxQVx1OEZDNyBQbGF5d3JpZ2h0IFx1NzY4NCBDRFAgXHU4MEZEXHU1MjlCICsgXHU5ODc1XHU5NzYyXHU0RThCXHU0RUY2XHVGRjBDXHU5MUM3XHU5NkM2XHVGRjFBXG4gKiAtIGNvbnNvbGUgXHU2RDg4XHU2MDZGL1x1OTUxOVx1OEJFRlxuICogLSBcdTdGNTFcdTdFRENcdThCRjdcdTZDNDJcdUZGMDhcdTU0MkJcdTU5MzFcdThEMjVcdTUyMDZcdTY3OTBcdUZGMDlcbiAqIC0gXHU2MDI3XHU4MEZEXHU2MzA3XHU2ODA3XHVGRjA4bmF2aWdhdGlvbiB0aW1pbmcgLyBMQ1AgLyBcdTk1N0ZcdTRFRkJcdTUyQTFcdUZGMDlcbiAqIC0gSlMgXHU2NzJBXHU2MzU1XHU4M0I3XHU1RjAyXHU1RTM4XG4gKi9cbmltcG9ydCB0eXBlIHsgUGFnZSB9IGZyb20gXCJwbGF5d3JpZ2h0XCI7XG5pbXBvcnQgdHlwZSB7IERpYWdub3N0aWNSZWYgfSBmcm9tIFwiQG9wZW5saXVsYW4vY29yZVwiO1xuaW1wb3J0IHR5cGUgeyBEaWFnbm9zdGljQ29sbGVjdG9yLCBOZXR3b3JrUmVjb3JkLCBQZXJmb3JtYW5jZU1ldHJpY3MgfSBmcm9tIFwiQG9wZW5saXVsYW4vZGlhZ25vc2lzXCI7XG5pbXBvcnQgeyBhbmFseXplTmV0d29yaywgYW5hbHl6ZVBlcmZvcm1hbmNlIH0gZnJvbSBcIkBvcGVubGl1bGFuL2RpYWdub3Npc1wiO1xuXG5leHBvcnQgY2xhc3MgQ29uc29sZUNvbGxlY3RvciBpbXBsZW1lbnRzIERpYWdub3N0aWNDb2xsZWN0b3Ige1xuICByZWFkb25seSBjYXRlZ29yeSA9IFwiY29uc29sZVwiIGFzIGNvbnN0O1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBhZ2U6IFBhZ2UsIHByaXZhdGUgYnVmZmVyOiBEaWFnbm9zdGljUmVmW10gPSBbXSkge31cblxuICBhc3luYyBjb2xsZWN0KCk6IFByb21pc2U8RGlhZ25vc3RpY1JlZltdPiB7XG4gICAgY29uc3QgcmVmcyA9IFsuLi50aGlzLmJ1ZmZlcl07XG4gICAgdGhpcy5idWZmZXIgPSBbXTtcbiAgICByZXR1cm4gcmVmcztcbiAgfVxuXG4gIC8qKiBcdTc1MzFcdTVGMTVcdTY0Q0VcdTU3MjhcdTk4NzVcdTk3NjJcdTc2RDFcdTU0MkNcdTY1RjZcdThDMDNcdTc1MjggKi9cbiAgcHVzaCh0ZXh0OiBzdHJpbmcsIGxldmVsOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBzZXZlcml0eSA9IGxldmVsID09PSBcImVycm9yXCIgPyBcImVycm9yXCIgOiBsZXZlbCA9PT0gXCJ3YXJuaW5nXCIgPyBcIndhcm5pbmdcIiA6IFwiaW5mb1wiO1xuICAgIHRoaXMuYnVmZmVyLnB1c2goe1xuICAgICAga2luZDogXCJjb25zb2xlXCIsXG4gICAgICBzZXZlcml0eSxcbiAgICAgIG1lc3NhZ2U6IHRleHQuc2xpY2UoMCwgNTAwKSxcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSnNFeGNlcHRpb25Db2xsZWN0b3IgaW1wbGVtZW50cyBEaWFnbm9zdGljQ29sbGVjdG9yIHtcbiAgcmVhZG9ubHkgY2F0ZWdvcnkgPSBcImpzLWV4Y2VwdGlvblwiIGFzIGNvbnN0O1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBhZ2U6IFBhZ2UsIHByaXZhdGUgYnVmZmVyOiBEaWFnbm9zdGljUmVmW10gPSBbXSkge31cblxuICBhc3luYyBjb2xsZWN0KCk6IFByb21pc2U8RGlhZ25vc3RpY1JlZltdPiB7XG4gICAgY29uc3QgcmVmcyA9IFsuLi50aGlzLmJ1ZmZlcl07XG4gICAgdGhpcy5idWZmZXIgPSBbXTtcbiAgICByZXR1cm4gcmVmcztcbiAgfVxuXG4gIHB1c2goZXJyb3I6IEVycm9yKTogdm9pZCB7XG4gICAgdGhpcy5idWZmZXIucHVzaCh7XG4gICAgICBraW5kOiBcImpzLWV4Y2VwdGlvblwiLFxuICAgICAgc2V2ZXJpdHk6IFwiZXJyb3JcIixcbiAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2Uuc2xpY2UoMCwgNTAwKSxcbiAgICAgIGRldGFpbDogeyBzdGFjazogZXJyb3Iuc3RhY2s/LnNsaWNlKDAsIDEyMDApIH0sXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5ldHdvcmtDb2xsZWN0b3IgaW1wbGVtZW50cyBEaWFnbm9zdGljQ29sbGVjdG9yIHtcbiAgcmVhZG9ubHkgY2F0ZWdvcnkgPSBcIm5ldHdvcmtcIiBhcyBjb25zdDtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwYWdlOiBQYWdlLCBwcml2YXRlIHJlY29yZHM6IE5ldHdvcmtSZWNvcmRbXSA9IFtdKSB7fVxuXG4gIGFzeW5jIGNvbGxlY3QoKTogUHJvbWlzZTxEaWFnbm9zdGljUmVmW10+IHtcbiAgICBjb25zdCB7IHJlZnMgfSA9IGFuYWx5emVOZXR3b3JrKHRoaXMucmVjb3Jkcyk7XG4gICAgdGhpcy5yZWNvcmRzID0gW107XG4gICAgcmV0dXJuIHJlZnM7XG4gIH1cblxuICAvKiogXHU3NTMxXHU1RjE1XHU2NENFXHU1NzI4XHU4QkY3XHU2QzQyXHU1QjhDXHU2MjEwXHU2NUY2XHU4QzAzXHU3NTI4ICovXG4gIHJlY29yZChyZWNvcmQ6IE5ldHdvcmtSZWNvcmQpOiB2b2lkIHtcbiAgICB0aGlzLnJlY29yZHMucHVzaChyZWNvcmQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQZXJmb3JtYW5jZUNvbGxlY3RvciBpbXBsZW1lbnRzIERpYWdub3N0aWNDb2xsZWN0b3Ige1xuICByZWFkb25seSBjYXRlZ29yeSA9IFwicGVyZm9ybWFuY2VcIiBhcyBjb25zdDtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwYWdlOiBQYWdlKSB7fVxuXG4gIGFzeW5jIGNvbGxlY3QoKTogUHJvbWlzZTxEaWFnbm9zdGljUmVmW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbWV0cmljcyA9IGF3YWl0IHRoaXMucGFnZS5ldmFsdWF0ZSgoKTogUGVyZm9ybWFuY2VNZXRyaWNzID0+IHtcbiAgICAgICAgY29uc3QgbmF2ID0gcGVyZm9ybWFuY2UuZ2V0RW50cmllc0J5VHlwZShcIm5hdmlnYXRpb25cIilbMF0gYXMgUGVyZm9ybWFuY2VOYXZpZ2F0aW9uVGltaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBwYWludCA9IHBlcmZvcm1hbmNlLmdldEVudHJpZXNCeVR5cGUoXCJwYWludFwiKSBhcyBQZXJmb3JtYW5jZUVudHJ5W107XG4gICAgICAgIGNvbnN0IGxjcEVudHJ5ID0gcGVyZm9ybWFuY2VcbiAgICAgICAgICAuZ2V0RW50cmllc0J5VHlwZShcImxhcmdlc3QtY29udGVudGZ1bC1wYWludFwiKVxuICAgICAgICAgIC5wb3AoKSBhcyBQZXJmb3JtYW5jZUVudHJ5IHwgdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCByZXNvdXJjZXMgPSBwZXJmb3JtYW5jZS5nZXRFbnRyaWVzQnlUeXBlKFwicmVzb3VyY2VcIikgYXMgUGVyZm9ybWFuY2VSZXNvdXJjZVRpbWluZ1tdO1xuXG4gICAgICAgIC8vIFx1OTU3Rlx1NEVGQlx1NTJBMVx1RkYxQT41MG1zIFx1ODlDNlx1NEUzQVx1OTYzQlx1NTg1RVxuICAgICAgICBjb25zdCBsb25nVGFza3MgPSAocGVyZm9ybWFuY2UgYXMgYW55KS5nZXRFbnRyaWVzQnlUeXBlXG4gICAgICAgICAgPyBwZXJmb3JtYW5jZS5nZXRFbnRyaWVzQnlUeXBlKFwibG9uZ3Rhc2tcIikubGVuZ3RoXG4gICAgICAgICAgOiAwO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHRmYjogbmF2ID8gbmF2LnJlc3BvbnNlU3RhcnQgLSBuYXYucmVxdWVzdFN0YXJ0IDogMCxcbiAgICAgICAgICBkb21Db250ZW50TG9hZGVkOiBuYXYgPyBuYXYuZG9tQ29udGVudExvYWRlZEV2ZW50U3RhcnQgLSBuYXYuc3RhcnRUaW1lIDogMCxcbiAgICAgICAgICBsb2FkRXZlbnQ6IG5hdiA/IG5hdi5sb2FkRXZlbnRFbmQgLSBuYXYuc3RhcnRUaW1lIDogMCxcbiAgICAgICAgICBmY3A6IHBhaW50LmZpbmQoKHApID0+IHAubmFtZSA9PT0gXCJmaXJzdC1jb250ZW50ZnVsLXBhaW50XCIpPy5zdGFydFRpbWUsXG4gICAgICAgICAgbGNwOiBsY3BFbnRyeT8uc3RhcnRUaW1lLFxuICAgICAgICAgIHJlc291cmNlczoge1xuICAgICAgICAgICAgY291bnQ6IHJlc291cmNlcy5sZW5ndGgsXG4gICAgICAgICAgICB0b3RhbEJ5dGVzOiByZXNvdXJjZXMucmVkdWNlKChzLCByKSA9PiBzICsgKHIudHJhbnNmZXJTaXplIHx8IDApLCAwKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxvbmdUYXNrcyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgeyByZWZzIH0gPSBhbmFseXplUGVyZm9ybWFuY2UobWV0cmljcyk7XG4gICAgICByZXR1cm4gcmVmcztcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBET00gXHU4QkNBXHU2NUFEXHU5MUM3XHU5NkM2XHU1NjY4XHVGRjFBXHU2OEMwXHU2RDRCXHU5ODc1XHU5NzYyXHU2RTMyXHU2N0QzXHU3MkI2XHU2MDAxXHVGRjBDXHU4ODY1XHU5RjUwXHUzMDBDXHU3NjdEXHU1QzRGL1x1NjcyQVx1NkUzMlx1NjdEMy9cdTY1RTBcdTRFQTRcdTRFOTJcdTMwMERcdThGRDlcdTdDN0JcbiAqIFx1NEVDRSBjb25zb2xlL25ldHdvcmsgXHU5MUNDXHU3NzBCXHU0RTBEXHU1MjMwXHU3Njg0IERPTSBcdTdFQTdcdTk1RUVcdTk4OThcdUZGMDhcdTVCRjlcdTVFOTRcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTVFOTNcdTc2ODQgYmxhbmstcGFnZSBcdTU3M0FcdTY2NkZcdUZGMDlcdTMwMDJcbiAqL1xuZXhwb3J0IGNsYXNzIERvbUNvbGxlY3RvciBpbXBsZW1lbnRzIERpYWdub3N0aWNDb2xsZWN0b3Ige1xuICByZWFkb25seSBjYXRlZ29yeSA9IFwiZG9tXCIgYXMgY29uc3Q7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcGFnZTogUGFnZSkge31cblxuICBhc3luYyBjb2xsZWN0KCk6IFByb21pc2U8RGlhZ25vc3RpY1JlZltdPiB7XG4gICAgY29uc3QgcmVmczogRGlhZ25vc3RpY1JlZltdID0gW107XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgdGhpcy5wYWdlLmV2YWx1YXRlKCgpID0+IHtcbiAgICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIGNvbnN0IGhhc0JvZHkgPSAhIWJvZHkgJiYgYm9keS5jaGlsZEVsZW1lbnRDb3VudCA+IDA7XG4gICAgICAgIC8vIFx1NTNFRlx1ODlDMVx1NEUxNFx1NTNFRlx1NEVBNFx1NEU5Mlx1NTE0M1x1N0QyMFx1NjU3MFx1OTFDRlx1RkYwOFx1NjM5Mlx1OTY2NFx1OTY5MFx1ODVDRi9cdTY1RTBcdTVFMDNcdTVDNDBcdTUxNDNcdTdEMjBcdUZGMDlcbiAgICAgICAgY29uc3QgdmlzaWJsZSA9IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImEsYnV0dG9uLGlucHV0LHNlbGVjdCx0ZXh0YXJlYSxbcm9sZV1cIikpXG4gICAgICAgICAgLmZpbHRlcigoZWwpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSAoZWwgYXMgSFRNTEVsZW1lbnQpLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgY29uc3QgcyA9IGdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgICAgICAgICAgcmV0dXJuIHMuZGlzcGxheSAhPT0gXCJub25lXCIgJiYgcy52aXNpYmlsaXR5ICE9PSBcImhpZGRlblwiICYmIHIud2lkdGggPiAwICYmIHIuaGVpZ2h0ID4gMDtcbiAgICAgICAgICB9KS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJvb3RcIikgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJhcHBcIik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaGFzQm9keSxcbiAgICAgICAgICB2aXNpYmxlSW50ZXJhY3RpdmU6IHZpc2libGUsXG4gICAgICAgICAgaGFzTW91bnQ6IHJvb3QgPyByb290LmNoaWxkRWxlbWVudENvdW50ID4gMCA6IG51bGwsXG4gICAgICAgICAgYm9keVRleHRMZW46IChkb2N1bWVudC5ib2R5Py5pbm5lclRleHQgfHwgXCJcIikudHJpbSgpLmxlbmd0aCxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBcdTc2N0RcdTVDNEYgLyBcdTY3MkFcdTZFMzJcdTY3RDNcdUZGMUFib2R5IFx1NjVFMFx1NUI1MFx1NTE0M1x1N0QyMCBcdTYyMTYgXHU2MzAyXHU4RjdEXHU4MjgyXHU3MEI5XHU3QTdBIFx1NEUxNCBcdTY1RTBcdTUzRUZcdTRFQTRcdTRFOTJcdTUxNDNcdTdEMjBcbiAgICAgIGNvbnN0IGJsYW5rID0gc3RhdGUuaGFzQm9keSA9PT0gZmFsc2UgfHwgKHN0YXRlLnZpc2libGVJbnRlcmFjdGl2ZSA9PT0gMCAmJiBzdGF0ZS5ib2R5VGV4dExlbiA9PT0gMCk7XG4gICAgICBpZiAoYmxhbmspIHtcbiAgICAgICAgcmVmcy5wdXNoKHtcbiAgICAgICAgICBraW5kOiBcImRvbVwiLFxuICAgICAgICAgIHNldmVyaXR5OiBcImVycm9yXCIsXG4gICAgICAgICAgbWVzc2FnZTogYFx1OTg3NVx1OTc2Mlx1NzU5MVx1NEYzQ1x1N0E3QVx1NzY3RC9cdTY3MkFcdTZFMzJcdTY3RDNcdUZGMUFib2R5IFx1NUI1MFx1NTE0M1x1N0QyMD0ke3N0YXRlLmhhc0JvZHl9XHVGRjBDXHU1M0VGXHU4OUMxXHU0RUE0XHU0RTkyXHU1MTQzXHU3RDIwPSR7c3RhdGUudmlzaWJsZUludGVyYWN0aXZlfVx1RkYwQ1x1NkI2M1x1NjU4Nz0ke3N0YXRlLmJvZHlUZXh0TGVufSBcdTVCNTdcdTdCMjZgLFxuICAgICAgICAgIGRldGFpbDogeyBoYXNNb3VudDogc3RhdGUuaGFzTW91bnQgfSxcbiAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZS52aXNpYmxlSW50ZXJhY3RpdmUgPT09IDApIHtcbiAgICAgICAgLy8gXHU5ODc1XHU5NzYyXHU2NzA5XHU1MTg1XHU1QkI5XHU0RjQ2XHU2NUUwXHU1M0VGXHU4OUMxXHU1M0VGXHU0RUE0XHU0RTkyXHU1MTQzXHU3RDIwXHVGRjA4XHU1M0VGXHU4MEZEXHU0RUE0XHU0RTkyXHU4OEFCXHU5MDZFXHU2MzIxL1x1OTcwMFx1ODk4MVx1NzY3Qlx1NUY1NVx1N0I0OVx1RkYwOVxuICAgICAgICByZWZzLnB1c2goe1xuICAgICAgICAgIGtpbmQ6IFwiZG9tXCIsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwid2FybmluZ1wiLFxuICAgICAgICAgIG1lc3NhZ2U6IGBcdTk4NzVcdTk3NjJcdTY1RTBcdTUzRUZcdTg5QzFcdTUzRUZcdTRFQTRcdTRFOTJcdTUxNDNcdTdEMjBcdUZGMDhcdTZCNjNcdTY1ODcgJHtzdGF0ZS5ib2R5VGV4dExlbn0gXHU1QjU3XHU3QjI2XHVGRjA5XHVGRjBDXHU1M0VGXHU4MEZEXHU5NzAwXHU3NjdCXHU1RjU1XHU2MjE2XHU1MTQzXHU3RDIwXHU4OEFCXHU5MDZFXHU2MzIxYCxcbiAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gRE9NIFx1OTFDN1x1OTZDNlx1NTkzMVx1OEQyNVx1NUZGRFx1NzU2NVx1RkYwOFx1NEUwRFx1OTYzQlx1NjVBRFx1NjU3NFx1NEY1M1x1OEJDQVx1NjVBRFx1RkYwOVxuICAgIH1cbiAgICByZXR1cm4gcmVmcztcbiAgfVxufVxuXG4vKiogXHU4MDVBXHU1NDA4XHU2MjQwXHU2NzA5XHU5MUM3XHU5NkM2XHU1NjY4ICovXG5leHBvcnQgY2xhc3MgUGxheXdyaWdodERpYWdub3N0aWNzIHtcbiAgY29uc29sZTogQ29uc29sZUNvbGxlY3RvcjtcbiAganNFeGNlcHRpb25zOiBKc0V4Y2VwdGlvbkNvbGxlY3RvcjtcbiAgbmV0d29yazogTmV0d29ya0NvbGxlY3RvcjtcbiAgcGVyZm9ybWFuY2U6IFBlcmZvcm1hbmNlQ29sbGVjdG9yO1xuICBkb206IERvbUNvbGxlY3RvcjtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBhZ2U6IFBhZ2UpIHtcbiAgICB0aGlzLmNvbnNvbGUgPSBuZXcgQ29uc29sZUNvbGxlY3Rvcih0aGlzLnBhZ2UpO1xuICAgIHRoaXMuanNFeGNlcHRpb25zID0gbmV3IEpzRXhjZXB0aW9uQ29sbGVjdG9yKHRoaXMucGFnZSk7XG4gICAgdGhpcy5uZXR3b3JrID0gbmV3IE5ldHdvcmtDb2xsZWN0b3IodGhpcy5wYWdlKTtcbiAgICB0aGlzLnBlcmZvcm1hbmNlID0gbmV3IFBlcmZvcm1hbmNlQ29sbGVjdG9yKHRoaXMucGFnZSk7XG4gICAgdGhpcy5kb20gPSBuZXcgRG9tQ29sbGVjdG9yKHRoaXMucGFnZSk7XG4gICAgdGhpcy53aXJlKCk7XG4gIH1cblxuICBwcml2YXRlIHdpcmUoKTogdm9pZCB7XG4gICAgdGhpcy5wYWdlLm9uKFwiY29uc29sZVwiLCAobXNnKSA9PiB0aGlzLmNvbnNvbGUucHVzaChtc2cudGV4dCgpLCBtc2cudHlwZSgpKSk7XG4gICAgdGhpcy5wYWdlLm9uKFwicGFnZWVycm9yXCIsIChlcnIpID0+IHRoaXMuanNFeGNlcHRpb25zLnB1c2goZXJyKSk7XG4gICAgdGhpcy5wYWdlLm9uKFwicmVxdWVzdGZhaWxlZFwiLCAocmVxKSA9PiB7XG4gICAgICB0aGlzLm5ldHdvcmsucmVjb3JkKHtcbiAgICAgICAgdXJsOiByZXEudXJsKCksXG4gICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCgpLFxuICAgICAgICBzdGF0dXM6IDAsXG4gICAgICAgIGVycm9yOiByZXEuZmFpbHVyZSgpPy5lcnJvclRleHQgfHwgXCJmYWlsZWRcIixcbiAgICAgICAgZHVyYXRpb25NczogMCxcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHRoaXMucGFnZS5vbihcInJlc3BvbnNlXCIsIChyZXMpID0+IHtcbiAgICAgIGNvbnN0IHJlcSA9IHJlcy5yZXF1ZXN0KCk7XG4gICAgICB0aGlzLm5ldHdvcmsucmVjb3JkKHtcbiAgICAgICAgdXJsOiByZXEudXJsKCksXG4gICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCgpLFxuICAgICAgICBzdGF0dXM6IHJlcy5zdGF0dXMoKSxcbiAgICAgICAgc3RhdHVzVGV4dDogcmVzLnN0YXR1c1RleHQoKSxcbiAgICAgICAgbWltZVR5cGU6IHJlcy5oZWFkZXJzKClbXCJjb250ZW50LXR5cGVcIl0sXG4gICAgICAgIGR1cmF0aW9uTXM6IDAsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbGxlY3RvcnMoKTogRGlhZ25vc3RpY0NvbGxlY3RvcltdIHtcbiAgICByZXR1cm4gW3RoaXMuY29uc29sZSwgdGhpcy5qc0V4Y2VwdGlvbnMsIHRoaXMubmV0d29yaywgdGhpcy5wZXJmb3JtYW5jZSwgdGhpcy5kb21dO1xuICB9XG59XG4iLCAiLyoqXHJcbiAqIFBsYXl3cmlnaHRFbmdpbmUgXHUyMDE0XHUyMDE0IFx1NUU5NVx1NUM0Mlx1OUE3MVx1NTJBOFx1NUI5RVx1NzNCMFxyXG4gKlxyXG4gKiBcdTU0MENcdTY1RjZcdTYzRDBcdTRGOUJcdUZGMUFcclxuICogLSBcdTdFREZcdTRFMDBcdTUyQThcdTRGNUNcdTYyNjdcdTg4NENcdUZGMDhcdTdDQkVcdTc4NkVcdTY0Q0RcdTRGNUNcdUZGMDlcclxuICogLSBcdTlBRDhcdTY1NDhcdTVGRUJcdTcxNjdcclxuICogLSA1IFx1NjYxRlx1OEJDQVx1NjVBRFx1OTFDN1x1OTZDNlx1RkYwOFx1OTAxQVx1OEZDNyBDRFAvXHU0RThCXHU0RUY2XHVGRjA5XHJcbiAqL1xyXG5pbXBvcnQgeyBjaHJvbWl1bSwgdHlwZSBCcm93c2VyLCB0eXBlIFBhZ2UsIHR5cGUgQnJvd3NlckNvbnRleHQgfSBmcm9tIFwicGxheXdyaWdodFwiO1xyXG5pbXBvcnQgdHlwZSB7IEJyb3dzZXJFbmdpbmUsIERpYWdub3N0aWNSZXBvcnQsIFVuaWZpZWRBY3Rpb24sIEFjdGlvblJlc3VsdCwgUGFnZVNuYXBzaG90LCBTbmFwc2hvdE9wdGlvbnMgfSBmcm9tIFwiQG9wZW5saXVsYW4vY29yZVwiO1xyXG5pbXBvcnQgeyBsb2NhdGVCeVNlbWFudGljIH0gZnJvbSBcIkBvcGVubGl1bGFuL2FpLWxheWVyXCI7XHJcbmltcG9ydCB7IFN0ZWFsdGhNYW5hZ2VyLCB0eXBlIFN0ZWFsdGhPcHRpb25zIH0gZnJvbSBcIkBvcGVubGl1bGFuL3N0ZWFsdGhcIjtcclxuaW1wb3J0IHsgRWxlbWVudExvY2F0b3IgfSBmcm9tIFwiLi9sb2NhdG9yLmpzXCI7XHJcbmltcG9ydCB7IFNuYXBzaG90QnVpbGRlciB9IGZyb20gXCIuL3NuYXBzaG90LmpzXCI7XHJcbmltcG9ydCB7IFBsYXl3cmlnaHREaWFnbm9zdGljcyB9IGZyb20gXCIuL2RpYWdub3N0aWNzLmpzXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFBsYXl3cmlnaHRFbmdpbmVPcHRpb25zIHtcclxuICBoZWFkbGVzcz86IGJvb2xlYW47XHJcbiAgLyoqIFx1OEZERVx1NjNBNVx1NTIzMFx1NURGMlx1NTQyRlx1NTJBOFx1NzY4NFx1NkQ0Rlx1ODlDOFx1NTY2OFx1RkYwOENEUFx1RkYwQ1x1NTAxRlx1OTI3NCBEZXZUb29scyBNQ1AgXHU3NkY0XHU4RkRFXHU4MEZEXHU1MjlCXHVGRjA5ICovXHJcbiAgY29ubmVjdFVybD86IHN0cmluZztcclxuICAvKiogXHU2RDRGXHU4OUM4XHU1NjY4XHU1M0VGXHU2MjY3XHU4ODRDXHU4REVGXHU1Rjg0ICovXHJcbiAgZXhlY3V0YWJsZVBhdGg/OiBzdHJpbmc7XHJcbiAgLyoqIFx1ODlDNlx1NTNFMyAqL1xyXG4gIHZpZXdwb3J0PzogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9O1xyXG4gIC8qKiBcdTk2MzJcdTY4QzBcdTZENEJcdTkxNERcdTdGNkVcdUZGMDhcdTUzRUZcdTkwMDlcdUZGMENcdTlFRDhcdThCQTRcdTUxNzNcdTk1RURcdUZGMDkgKi9cclxuICBzdGVhbHRoPzogU3RlYWx0aE9wdGlvbnMgfCBTdGVhbHRoTWFuYWdlcjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFBsYXl3cmlnaHRFbmdpbmUgaW1wbGVtZW50cyBCcm93c2VyRW5naW5lIHtcclxuICByZWFkb25seSBuYW1lID0gXCJwbGF5d3JpZ2h0K2NkcFwiO1xyXG4gIHByaXZhdGUgYnJvd3Nlcj86IEJyb3dzZXI7XHJcbiAgcHJpdmF0ZSBjb250ZXh0PzogQnJvd3NlckNvbnRleHQ7XHJcbiAgcHJpdmF0ZSBwYWdlPzogUGFnZTtcclxuICBwcml2YXRlIGxvY2F0b3I/OiBFbGVtZW50TG9jYXRvcjtcclxuICBwcml2YXRlIHNuYXBzaG90QnVpbGRlcj86IFNuYXBzaG90QnVpbGRlcjtcclxuICBwcml2YXRlIGRpYWdub3N0aWNzPzogUGxheXdyaWdodERpYWdub3N0aWNzO1xyXG4gIHByaXZhdGUgb3B0aW9uczogUGxheXdyaWdodEVuZ2luZU9wdGlvbnM7XHJcbiAgLyoqIFx1OTYzMlx1NjhDMFx1NkQ0Qlx1N0JBMVx1NzQwNlx1NTY2OCAqL1xyXG4gIHByaXZhdGUgc3RlYWx0aD86IFN0ZWFsdGhNYW5hZ2VyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBQbGF5d3JpZ2h0RW5naW5lT3B0aW9ucyA9IHt9KSB7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSB7IGhlYWRsZXNzOiB0cnVlLCB2aWV3cG9ydDogeyB3aWR0aDogMTI4MCwgaGVpZ2h0OiA4MDAgfSwgLi4ub3B0aW9ucyB9O1xyXG4gICAgLy8gXHU2Nzg0XHU5MDIwIHN0ZWFsdGggXHU3QkExXHU3NDA2XHU1NjY4XHVGRjA4XHU2M0E1XHU1M0Q3IFN0ZWFsdGhNYW5hZ2VyIFx1NUI5RVx1NEY4Qlx1NjIxNlx1OTE0RFx1N0Y2RVx1NUJGOVx1OEM2MVx1RkYwOVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdGVhbHRoIGluc3RhbmNlb2YgU3RlYWx0aE1hbmFnZXIpIHtcclxuICAgICAgdGhpcy5zdGVhbHRoID0gdGhpcy5vcHRpb25zLnN0ZWFsdGg7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5zdGVhbHRoKSB7XHJcbiAgICAgIHRoaXMuc3RlYWx0aCA9IG5ldyBTdGVhbHRoTWFuYWdlcih0aGlzLm9wdGlvbnMuc3RlYWx0aCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiogXHU1RjUzXHU1MjREIHN0ZWFsdGggXHU2NjJGXHU1NDI2XHU1NDJGXHU3NTI4ICovXHJcbiAgZ2V0IHN0ZWFsdGhFbmFibGVkKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc3RlYWx0aD8uaXNFbmFibGVkID8/IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgaW5pdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGxhdW5jaEFyZ3MgPSB0aGlzLnN0ZWFsdGg/LmJ1aWxkTGF1bmNoQXJncygpID8/IFtdO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jb25uZWN0VXJsKSB7XHJcbiAgICAgIC8vIENEUCBcdTc2RjRcdThGREVcdUZGMDhcdTUwMUZcdTkyNzQgQ2hyb21lIERldlRvb2xzIE1DUCBcdTc2ODRcdTgwRkRcdTUyOUJcdUZGMDlcclxuICAgICAgdGhpcy5icm93c2VyID0gYXdhaXQgY2hyb21pdW0uY29ubmVjdE92ZXJDRFAodGhpcy5vcHRpb25zLmNvbm5lY3RVcmwpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5icm93c2VyID0gYXdhaXQgY2hyb21pdW0ubGF1bmNoKHtcclxuICAgICAgICBoZWFkbGVzczogdGhpcy5vcHRpb25zLmhlYWRsZXNzLFxyXG4gICAgICAgIGV4ZWN1dGFibGVQYXRoOiB0aGlzLm9wdGlvbnMuZXhlY3V0YWJsZVBhdGgsXHJcbiAgICAgICAgYXJnczogbGF1bmNoQXJncy5sZW5ndGggPyBsYXVuY2hBcmdzIDogdW5kZWZpbmVkLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8vIFx1NTIxQlx1NUVGQVx1NEUwQVx1NEUwQlx1NjU4N1x1RkYxQVx1ODJFNVx1NTQyRlx1NzUyOCBzdGVhbHRoXHVGRjBDXHU2Q0U4XHU1MTY1XHU1M0NEXHU2MzA3XHU3RUI5XHU4MTFBXHU2NzJDXHU0RTBFIFVBXHJcbiAgICBjb25zdCBjdHhPcHRpb25zOiBhbnkgPSB7IHZpZXdwb3J0OiB0aGlzLm9wdGlvbnMudmlld3BvcnQgfTtcclxuICAgIGlmICh0aGlzLnN0ZWFsdGg/LmlzRW5hYmxlZCkge1xyXG4gICAgICBjb25zdCBpbml0U2NyaXB0ID0gdGhpcy5zdGVhbHRoLmJ1aWxkSW5pdFNjcmlwdCgpO1xyXG4gICAgICBpZiAoaW5pdFNjcmlwdCkgY3R4T3B0aW9ucy5pbml0U2NyaXB0ID0gaW5pdFNjcmlwdDtcclxuICAgICAgaWYgKHRoaXMuc3RlYWx0aC5vcHRpb25zLnVzZXJBZ2VudCkgY3R4T3B0aW9ucy51c2VyQWdlbnQgPSB0aGlzLnN0ZWFsdGgub3B0aW9ucy51c2VyQWdlbnQ7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNvbnRleHQgPSB0aGlzLmJyb3dzZXIuY29udGV4dHMoKVswXSB8fCAoYXdhaXQgdGhpcy5icm93c2VyLm5ld0NvbnRleHQoY3R4T3B0aW9ucykpO1xyXG4gICAgdGhpcy5wYWdlID0gdGhpcy5jb250ZXh0LnBhZ2VzKClbMF0gfHwgKGF3YWl0IHRoaXMuY29udGV4dC5uZXdQYWdlKCkpO1xyXG4gICAgdGhpcy5kaWFnbm9zdGljcyA9IG5ldyBQbGF5d3JpZ2h0RGlhZ25vc3RpY3ModGhpcy5wYWdlKTtcclxuICAgIHRoaXMuc25hcHNob3RCdWlsZGVyID0gbmV3IFNuYXBzaG90QnVpbGRlcih0aGlzLnBhZ2UpO1xyXG4gICAgdGhpcy5sb2NhdG9yID0gbmV3IEVsZW1lbnRMb2NhdG9yKHRoaXMucGFnZSwge1xyXG4gICAgICAvLyBcdThCRURcdTRFNDlcdTVCOUFcdTRGNERcdTk0RkVcdThERUZcdUZGMUFhcmlhL3BsYWNlaG9sZGVyIFx1NTE1Q1x1NUU5NVx1NTkzMVx1OEQyNVx1NTQwRVx1RkYwQ1x1NTdGQVx1NEU4RVx1NUZFQlx1NzE2N1x1NTA1QVx1NEUyRFx1NjU4N1x1NTIwNlx1OEJDRCtcdThCRURcdTRFNDlcdTc2RjhcdTRGM0NcdTVFQTZcdTUzMzlcdTkxNERcclxuICAgICAgcmVzb2x2ZTogYXN5bmMgKHNlbWFudGljKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgc25hcCA9IGF3YWl0IHRoaXMuc25hcHNob3RCdWlsZGVyIS5idWlsZCh7IG1heE5vZGVzOiAyMDAsIG1heFRleHRMZW5ndGg6IDgwIH0pO1xyXG4gICAgICAgIGNvbnN0IGhpdCA9IGxvY2F0ZUJ5U2VtYW50aWMoc25hcCwgc2VtYW50aWMpO1xyXG4gICAgICAgIGlmIChoaXQgJiYgKGhpdC5yZWYgfHwgaGl0LnNlbGVjdG9yKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHsgcmVmOiBoaXQucmVmLCB0ZXh0OiBoaXQudGV4dCwgc2VsZWN0b3I6IGhpdC5zZWxlY3RvciB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmJyb3dzZXI/LmNsb3NlKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBleGVjdXRlKGFjdGlvbjogVW5pZmllZEFjdGlvbik6IFByb21pc2U8QWN0aW9uUmVzdWx0PiB7XHJcbiAgICBpZiAoIXRoaXMucGFnZSkgdGhyb3cgbmV3IEVycm9yKFwiXHU1RjE1XHU2NENFXHU2NzJBXHU1MjFEXHU1OUNCXHU1MzE2XHVGRjBDXHU4QkY3XHU1MTQ4XHU4QzAzXHU3NTI4IGluaXQoKVwiKTtcclxuICAgIGNvbnN0IHQwID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICBzd2l0Y2ggKGFjdGlvbi50eXBlKSB7XHJcbiAgICAgIGNhc2UgXCJuYXZpZ2F0ZVwiOiB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5wYWdlLmdvdG8oYWN0aW9uLnVybCwgeyB3YWl0VW50aWw6IGFjdGlvbi53YWl0VW50aWwgPz8gXCJuZXR3b3JraWRsZVwiLCB0aW1lb3V0OiAzMF8wMDAgfSk7XHJcbiAgICAgICAgdGhpcy5kaWFnbm9zdGljcz8ubmV0d29yay5yZWNvcmQoe1xyXG4gICAgICAgICAgdXJsOiBhY3Rpb24udXJsLFxyXG4gICAgICAgICAgbWV0aG9kOiBcIk5BVlwiLFxyXG4gICAgICAgICAgc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gdDAsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIHR5cGU6IFwibmF2aWdhdGVcIiwgc3VtbWFyeTogYFx1NURGMlx1NUJGQ1x1ODIyQVx1NTIzMCAke2FjdGlvbi51cmx9YCwgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHQwIH07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNhc2UgXCJjbGlja1wiOiB7XHJcbiAgICAgICAgY29uc3QgeyBsb2NhdG9yLCBzdHJhdGVneSwgYW5jaG9yU2VsZWN0b3IgfSA9IGF3YWl0IHRoaXMubG9jYXRvciEubG9jYXRlKHtcclxuICAgICAgICAgIHJlZjogYWN0aW9uLnJlZixcclxuICAgICAgICAgIHNlbGVjdG9yOiBhY3Rpb24uc2VsZWN0b3IsXHJcbiAgICAgICAgICB0ZXh0OiBhY3Rpb24udGV4dCxcclxuICAgICAgICAgIHNlbWFudGljOiBhY3Rpb24uc2VtYW50aWMsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgLy8gXHU3MEI5XHU1MUZCXHU1M0VGXHU4MEZEXHU4OUU2XHU1M0QxXHU5ODc1XHU5NzYyXHU1QkZDXHU4MjJBXHVGRjA4XHU1OTgyXHU3MEI5XHU1MUZCPGE+XHU5NEZFXHU2M0E1XHU4REYzXHU4RjZDXHVGRjA5XHUzMDAyXHJcbiAgICAgICAgLy8gXHU1M0VBXHU2NzA5XHU3MEI5XHU1MUZCXHU3NkVFXHU2ODA3XHU2NjJGXHU5NEZFXHU2M0E1XHU2NUY2XHU2MjREXHU3QjQ5XHU1Rjg1XHU2NUIwXHU5ODc1XHU5NzYyXHU1MkEwXHU4RjdEXHVGRjBDXHU5MDdGXHU1MTREXHU2NjZFXHU5MDFBXHU2MzA5XHU5NEFFXHU2NUUwXHU4QzEzXHU3QjQ5XHU1Rjg1XHU1QkZDXHU4MjJBXHU4RDg1XHU2NUY2XHUzMDAyXHJcbiAgICAgICAgY29uc3Qgd2FpdEZvck5hdmlnYXRpb24gPSBhY3Rpb24ud2FpdEZvck5hdmlnYXRpb24gPz8gdHJ1ZTtcclxuICAgICAgICBjb25zdCBpc0xpbmsgPSBhd2FpdCBsb2NhdG9yXHJcbiAgICAgICAgICAuZXZhbHVhdGUoKGVsKSA9PiBlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwiYVwiICYmICEhZWwuZ2V0QXR0cmlidXRlKFwiaHJlZlwiKSlcclxuICAgICAgICAgIC5jYXRjaCgoKSA9PiBmYWxzZSk7XHJcbiAgICAgICAgY29uc3QgbmF2UHJvbWlzZSA9XHJcbiAgICAgICAgICB3YWl0Rm9yTmF2aWdhdGlvbiAmJiBpc0xpbmtcclxuICAgICAgICAgICAgPyB0aGlzLnBhZ2VcclxuICAgICAgICAgICAgICAgIC53YWl0Rm9yTmF2aWdhdGlvbih7IHdhaXRVbnRpbDogXCJsb2FkXCIsIHRpbWVvdXQ6IDE1XzAwMCB9KVxyXG4gICAgICAgICAgICAgICAgLmNhdGNoKCgpID0+IG51bGwpIC8vIFx1NjcyQVx1ODlFNlx1NTNEMVx1NUJGQ1x1ODIyQVx1NjVGNlx1OTc1OVx1OUVEOFx1NUZGRFx1NzU2NVxyXG4gICAgICAgICAgICA6IG51bGw7XHJcbiAgICAgICAgYXdhaXQgbG9jYXRvci5jbGljayh7XHJcbiAgICAgICAgICBidXR0b246IGFjdGlvbi5idXR0b24sXHJcbiAgICAgICAgICBjbGlja0NvdW50OiBhY3Rpb24uY2xpY2tDb3VudCxcclxuICAgICAgICAgIGZvcmNlOiBhY3Rpb24uZm9yY2UsXHJcbiAgICAgICAgICB0aW1lb3V0OiAxNV8wMDAsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgLy8gXHU4MkU1XHU3MEI5XHU1MUZCXHU5NEZFXHU2M0E1XHU4OUU2XHU1M0QxXHU0RTg2XHU1QkZDXHU4MjJBXHVGRjBDXHU1MjE5XHU3QjQ5XHU1Rjg1XHU1MTc2XHU1QjhDXHU2MjEwXHU1NDBFXHU1MThEXHU4RkQ0XHU1NkRFXHVGRjBDXHU0RkREXHU4QkMxXHU1NDBFXHU3RUVEXHU2NENEXHU0RjVDXHU5NzYyXHU1QkY5XHU3QTMzXHU1QjlBXHU5ODc1XHU5NzYyXHJcbiAgICAgICAgaWYgKG5hdlByb21pc2UpIGF3YWl0IG5hdlByb21pc2U7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIG9rOiB0cnVlLFxyXG4gICAgICAgICAgdHlwZTogXCJjbGlja1wiLFxyXG4gICAgICAgICAgc3VtbWFyeTogYFx1NURGMlx1NzBCOVx1NTFGQlx1RkYwOFx1N0I1Nlx1NzU2NT0ke3N0cmF0ZWd5fSBcdTk1MUFcdTcwQjk9JHthbmNob3JTZWxlY3Rvcn0ke25hdlByb21pc2UgPyBcIixcdTVERjJcdTdCNDlcdTVGODVcdTVCRkNcdTgyMkFcdTdBMzNcdTVCOUFcIiA6IFwiXCJ9XHVGRjA5YCxcclxuICAgICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSB0MCxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlIFwiZmlsbFwiOiB7XHJcbiAgICAgICAgY29uc3QgeyBsb2NhdG9yLCBzdHJhdGVneSB9ID0gYXdhaXQgdGhpcy5sb2NhdG9yIS5sb2NhdGUoe1xyXG4gICAgICAgICAgcmVmOiBhY3Rpb24ucmVmLFxyXG4gICAgICAgICAgc2VsZWN0b3I6IGFjdGlvbi5zZWxlY3RvcixcclxuICAgICAgICAgIHRleHQ6IGFjdGlvbi50ZXh0LFxyXG4gICAgICAgICAgc2VtYW50aWM6IGFjdGlvbi5zZW1hbnRpYyxcclxuICAgICAgICB9KTtcclxuICAgICAgICBhd2FpdCBsb2NhdG9yLmZpbGwoYWN0aW9uLnZhbHVlKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgb2s6IHRydWUsXHJcbiAgICAgICAgICB0eXBlOiBcImZpbGxcIixcclxuICAgICAgICAgIHN1bW1hcnk6IGBcdTVERjJcdTU4NkJcdTUxNjVcdTUxODVcdTVCQjlcdUZGMDhcdTdCNTZcdTc1NjU9JHtzdHJhdGVneX1cdUZGMDlgLFxyXG4gICAgICAgICAgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHQwLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNhc2UgXCJ0eXBlXCI6IHtcclxuICAgICAgICBjb25zdCB7IGxvY2F0b3IsIHN0cmF0ZWd5IH0gPSBhd2FpdCB0aGlzLmxvY2F0b3IhLmxvY2F0ZSh7XHJcbiAgICAgICAgICByZWY6IGFjdGlvbi5yZWYsXHJcbiAgICAgICAgICBzZWxlY3RvcjogYWN0aW9uLnNlbGVjdG9yLFxyXG4gICAgICAgICAgdGV4dDogYWN0aW9uLnRleHQsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgYXdhaXQgbG9jYXRvci5jbGljaygpO1xyXG4gICAgICAgIC8vIHN0ZWFsdGggXHU2QTIxXHU1RjBGXHU0RTBCXHVGRjFBXHU5MDEwXHU5NTJFXHU4RjkzXHU1MTY1XHU1RTI2XHU0RUJBXHU3QzdCXHU1MzE2XHU5NjhGXHU2NzNBXHU1RUY2XHU4RkRGXHVGRjA4XHU5MDdGXHU1MTREXHU4RjkzXHU1MTY1XHU1OTJBXHU1RkVCXHU4OEFCXHU4QkM2XHU1MjJCXHU0RTNBXHU2NzNBXHU1NjY4XHU0RUJBXHVGRjA5XHJcbiAgICAgICAgY29uc3QgZGVsYXkgPSBhY3Rpb24uZGVsYXkgPz8gKHRoaXMuc3RlYWx0aD8uaXNFbmFibGVkID8gdGhpcy5zdGVhbHRoLmh1bWFuVHlwaW5nRGVsYXlNcygpIDogdW5kZWZpbmVkKTtcclxuICAgICAgICBhd2FpdCB0aGlzLnBhZ2Uua2V5Ym9hcmQudHlwZShhY3Rpb24udmFsdWUsIHsgZGVsYXk6IGRlbGF5ID8/IDAgfSk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIG9rOiB0cnVlLFxyXG4gICAgICAgICAgdHlwZTogXCJ0eXBlXCIsXHJcbiAgICAgICAgICBzdW1tYXJ5OiBgXHU1REYyXHU5MDEwXHU5NTJFXHU4RjkzXHU1MTY1XHVGRjA4XHU3QjU2XHU3NTY1PSR7c3RyYXRlZ3l9JHt0aGlzLnN0ZWFsdGg/LmlzRW5hYmxlZCA/IFwiLHN0ZWFsdGhcdTVFRjZcdThGREZcIiA6IFwiXCJ9XHVGRjA5YCxcclxuICAgICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSB0MCxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlIFwic2VsZWN0XCI6IHtcclxuICAgICAgICBjb25zdCB7IGxvY2F0b3IsIHN0cmF0ZWd5IH0gPSBhd2FpdCB0aGlzLmxvY2F0b3IhLmxvY2F0ZSh7XHJcbiAgICAgICAgICByZWY6IGFjdGlvbi5yZWYsXHJcbiAgICAgICAgICBzZWxlY3RvcjogYWN0aW9uLnNlbGVjdG9yLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGF3YWl0IGxvY2F0b3Iuc2VsZWN0T3B0aW9uKGFjdGlvbi52YWx1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIG9rOiB0cnVlLFxyXG4gICAgICAgICAgdHlwZTogXCJzZWxlY3RcIixcclxuICAgICAgICAgIHN1bW1hcnk6IGBcdTVERjJcdTkwMDlcdTYyRTlcdTkwMDlcdTk4NzlcdUZGMDhcdTdCNTZcdTc1NjU9JHtzdHJhdGVneX1cdUZGMDlgLFxyXG4gICAgICAgICAgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHQwLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNhc2UgXCJleHRyYWN0XCI6IHtcclxuICAgICAgICBjb25zdCB7IGxvY2F0b3IgfSA9IGF3YWl0IHRoaXMubG9jYXRvciEubG9jYXRlKHtcclxuICAgICAgICAgIHJlZjogYWN0aW9uLnJlZixcclxuICAgICAgICAgIHNlbGVjdG9yOiBhY3Rpb24uc2VsZWN0b3IsXHJcbiAgICAgICAgICB0ZXh0OiBhY3Rpb24udGV4dCxcclxuICAgICAgICAgIHNlbWFudGljOiBhY3Rpb24uc2VtYW50aWMsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGxvY2F0b3IuZXZhbHVhdGUoKGVsKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBjbG9uZSA9IGVsLmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgIGNvbnN0IHRleHQgPSAoY2xvbmUuaW5uZXJUZXh0IHx8IGNsb25lLnRleHRDb250ZW50IHx8IFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcclxuICAgICAgICAgIHJldHVybiB7IHRleHQ6IHRleHQuc2xpY2UoMCwgMjAwMCkgfTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4geyBvazogdHJ1ZSwgdHlwZTogXCJleHRyYWN0XCIsIHN1bW1hcnk6IFwiXHU2M0QwXHU1M0Q2XHU1QjhDXHU2MjEwXCIsIGRhdGEsIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSB0MCB9O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlIFwiYXNzZXJ0XCI6IHtcclxuICAgICAgICBjb25zdCB7IGxvY2F0b3IgfSA9IGF3YWl0IHRoaXMubG9jYXRvciEubG9jYXRlKHtcclxuICAgICAgICAgIHJlZjogYWN0aW9uLnJlZixcclxuICAgICAgICAgIHNlbGVjdG9yOiBhY3Rpb24uc2VsZWN0b3IsXHJcbiAgICAgICAgICB0ZXh0OiBhY3Rpb24udGV4dCxcclxuICAgICAgICAgIHNlbWFudGljOiBhY3Rpb24uc2VtYW50aWMsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY29uc3QgY291bnQgPSBhd2FpdCBsb2NhdG9yLmNvdW50KCk7XHJcbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHR5cGU6IFwiYXNzZXJ0XCIsIHN1bW1hcnk6IGBcdTY1QURcdThBMDBcdTU5MzFcdThEMjVcdUZGMUFcdTY3MkFcdTYyN0VcdTUyMzBcdTc2RUVcdTY4MDdcdTUxNDNcdTdEMjBgLCBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gdDAgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgZWwgPSBsb2NhdG9yLmZpcnN0KCk7XHJcbiAgICAgICAgY29uc3QgdmlzaWJsZSA9IGF3YWl0IGVsLmlzVmlzaWJsZSgpLmNhdGNoKCgpID0+IGZhbHNlKTtcclxuICAgICAgICBjb25zdCB0ZXh0ID0gKGF3YWl0IGVsLmlubmVyVGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpKSB8fCBcIlwiO1xyXG4gICAgICAgIGxldCBwYXNzID0gdHJ1ZTtcclxuICAgICAgICBsZXQgZGV0YWlsID0gXCJcIjtcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbi5tb2RlKSB7XHJcbiAgICAgICAgICBjYXNlIFwidmlzaWJsZVwiOlxyXG4gICAgICAgICAgICBwYXNzID0gdmlzaWJsZTtcclxuICAgICAgICAgICAgZGV0YWlsID0gYFx1NTNFRlx1ODlDMT0ke3Zpc2libGV9YDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICBjYXNlIFwiZXhpc3RzXCI6XHJcbiAgICAgICAgICAgIHBhc3MgPSB0cnVlO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGNhc2UgXCJoaWRkZW5cIjpcclxuICAgICAgICAgICAgcGFzcyA9ICF2aXNpYmxlO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGNhc2UgXCJ0ZXh0LWNvbnRhaW5zXCI6XHJcbiAgICAgICAgICAgIHBhc3MgPSBhY3Rpb24uZXhwZWN0ZWQgPyB0ZXh0LmluY2x1ZGVzKGFjdGlvbi5leHBlY3RlZCkgOiBmYWxzZTtcclxuICAgICAgICAgICAgZGV0YWlsID0gYFx1NjU4N1x1NjcyQ1x1NTMwNVx1NTQyQicke2FjdGlvbi5leHBlY3RlZH0nPSR7cGFzc30gXHU1QjlFXHU5NjQ1PScke3RleHQuc2xpY2UoMCwgNTApfSdgO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGNhc2UgXCJlbmFibGVkXCI6XHJcbiAgICAgICAgICAgIHBhc3MgPSBhd2FpdCBlbC5pc0VuYWJsZWQoKS5jYXRjaCgoKSA9PiBmYWxzZSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgcGFzcyA9IHZpc2libGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBvazogcGFzcyxcclxuICAgICAgICAgIHR5cGU6IFwiYXNzZXJ0XCIsXHJcbiAgICAgICAgICBzdW1tYXJ5OiBgXHU2NUFEXHU4QTAwJHtwYXNzID8gXCJcdTkwMUFcdThGQzdcIiA6IFwiXHU1OTMxXHU4RDI1XCJ9OiAke2FjdGlvbi5tb2RlfSAke2RldGFpbH1gLFxyXG4gICAgICAgICAgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHQwLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNhc2UgXCJzY3JlZW5zaG90XCI6IHtcclxuICAgICAgICBjb25zdCBidWYgPSBhY3Rpb24uZnVsbFBhZ2VcclxuICAgICAgICAgID8gYXdhaXQgdGhpcy5wYWdlLnNjcmVlbnNob3QoeyBmdWxsUGFnZTogdHJ1ZSwgY2xpcDogYWN0aW9uLmNsaXAgfSlcclxuICAgICAgICAgIDogYXdhaXQgdGhpcy5wYWdlLnNjcmVlbnNob3QoeyBjbGlwOiBhY3Rpb24uY2xpcCB9KTtcclxuICAgICAgICBjb25zdCBiYXNlNjQgPSBidWYudG9TdHJpbmcoXCJiYXNlNjRcIik7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIG9rOiB0cnVlLFxyXG4gICAgICAgICAgdHlwZTogXCJzY3JlZW5zaG90XCIsXHJcbiAgICAgICAgICBzdW1tYXJ5OiBgXHU1REYyXHU2MjJBXHU1NkZFICgkeyhiYXNlNjQubGVuZ3RoICogMC43NSkgLyAxMDI0fUtCLCAke2Jhc2U2NC5sZW5ndGh9IGI2NClgLFxyXG4gICAgICAgICAgZGF0YTogeyBiYXNlNjQgfSxcclxuICAgICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSB0MCxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlIFwiaG92ZXJcIjoge1xyXG4gICAgICAgIGNvbnN0IHsgbG9jYXRvciB9ID0gYXdhaXQgdGhpcy5sb2NhdG9yIS5sb2NhdGUoeyByZWY6IGFjdGlvbi5yZWYsIHNlbGVjdG9yOiBhY3Rpb24uc2VsZWN0b3IgfSk7XHJcbiAgICAgICAgYXdhaXQgbG9jYXRvci5ob3ZlcigpO1xyXG4gICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCB0eXBlOiBcImhvdmVyXCIsIHN1bW1hcnk6IFwiXHU1REYyXHU2MEFDXHU1MDVDXCIsIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSB0MCB9O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlIFwic2Nyb2xsXCI6IHtcclxuICAgICAgICBhd2FpdCB0aGlzLnBhZ2UubW91c2Uud2hlZWwoMCwgKGFjdGlvbiBhcyBhbnkpLmRlbHRhWSA/PyA2MDApO1xyXG4gICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCB0eXBlOiBcInNjcm9sbFwiLCBzdW1tYXJ5OiBcIlx1NURGMlx1NkVEQVx1NTJBOFwiLCBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gdDAgfTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY2FzZSBcIndhaXRcIjoge1xyXG4gICAgICAgIGF3YWl0IHRoaXMucGFnZS53YWl0Rm9yVGltZW91dCgoYWN0aW9uIGFzIGFueSkubXMgPz8gMTAwMCk7XHJcbiAgICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIHR5cGU6IFwid2FpdFwiLCBzdW1tYXJ5OiBcIlx1NURGMlx1N0I0OVx1NUY4NVwiLCBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gdDAgfTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY2FzZSBcImV2YWx1YXRlXCI6IHtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBhZ2UuZXZhbHVhdGUoKGFjdGlvbiBhcyBhbnkpLnNjcmlwdCBhcyBzdHJpbmcpO1xyXG4gICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCB0eXBlOiBcImV2YWx1YXRlXCIsIHN1bW1hcnk6IFwiSlMgXHU2MjY3XHU4ODRDXHU1QjhDXHU2MjEwXCIsIGRhdGE6IHJlc3VsdCwgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHQwIH07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNhc2UgXCJwcmVzc1wiOiB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5wYWdlLmtleWJvYXJkLnByZXNzKChhY3Rpb24gYXMgYW55KS5rZXkgPz8gXCJFbnRlclwiKTtcclxuICAgICAgICByZXR1cm4geyBvazogdHJ1ZSwgdHlwZTogXCJwcmVzc1wiLCBzdW1tYXJ5OiBgXHU1REYyXHU2MzA5XHU5NTJFICR7KGFjdGlvbiBhcyBhbnkpLmtleX1gLCBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gdDAgfTtcclxuICAgICAgfVxyXG5cclxuICAgICAgZGVmYXVsdDoge1xyXG4gICAgICAgIGNvbnN0IGEgPSBhY3Rpb24gYXMgYW55O1xyXG4gICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgdHlwZTogYS50eXBlLCBzdW1tYXJ5OiBgXHU0RTBEXHU2NTJGXHU2MzAxXHU3Njg0IGFjdGlvbjogJHthLnR5cGV9YCwgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHQwIH07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHNuYXBzaG90KG9wdGlvbnM/OiBTbmFwc2hvdE9wdGlvbnMpOiBQcm9taXNlPFBhZ2VTbmFwc2hvdD4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc25hcHNob3RCdWlsZGVyIS5idWlsZChvcHRpb25zKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGRpYWdub3NlKCk6IFByb21pc2U8RGlhZ25vc3RpY1JlcG9ydD4ge1xyXG4gICAgY29uc3QgY29sbGVjdG9ycyA9IHRoaXMuZGlhZ25vc3RpY3MhLmNvbGxlY3RvcnMoKTtcclxuICAgIGNvbnN0IGNvbGxlY3RlZCA9IGF3YWl0IFByb21pc2UuYWxsKFxyXG4gICAgICBjb2xsZWN0b3JzLm1hcChhc3luYyAoYykgPT4gKHsgY2F0ZWdvcnk6IGMuY2F0ZWdvcnksIHJlZnM6IGF3YWl0IGMuY29sbGVjdCgpIH0pKVxyXG4gICAgKTtcclxuICAgIGNvbnN0IGJ5Q2F0ID0gKGNhdDogc3RyaW5nKSA9PlxyXG4gICAgICBjb2xsZWN0ZWQuZmluZCgoYykgPT4gYy5jYXRlZ29yeSA9PT0gY2F0KT8ucmVmcyA/PyBbXTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGNvbnNvbGU6IGJ5Q2F0KFwiY29uc29sZVwiKSxcclxuICAgICAgbmV0d29yazogYnlDYXQoXCJuZXR3b3JrXCIpLFxyXG4gICAgICBkb206IGJ5Q2F0KFwiZG9tXCIpLFxyXG4gICAgICBwZXJmb3JtYW5jZTogYnlDYXQoXCJwZXJmb3JtYW5jZVwiKSxcclxuICAgICAganNFeGNlcHRpb25zOiBieUNhdChcImpzLWV4Y2VwdGlvblwiKSxcclxuICAgICAgYWNjZXNzaWJpbGl0eTogYnlDYXQoXCJhY2Nlc3NpYmlsaXR5XCIpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGNvbGxlY3RDb25zb2xlKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZGlhZ25vc3RpY3MhLmNvbnNvbGUuY29sbGVjdCgpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgY29sbGVjdE5ldHdvcmsoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5kaWFnbm9zdGljcyEubmV0d29yay5jb2xsZWN0KCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBldmFsdWF0ZShzY3JpcHQ6IHN0cmluZyk6IFByb21pc2U8dW5rbm93bj4ge1xyXG4gICAgcmV0dXJuIHRoaXMucGFnZSEuZXZhbHVhdGUoc2NyaXB0KTtcclxuICB9XHJcbn1cclxuIiwgIi8qKlxuICogXHU4QkVEXHU0RTQ5XHU1QjlBXHU0RjREXHU1NjY4XHVGRjFBXHU2MjhBXHU4MUVBXHU3MTM2XHU4QkVEXHU4QTAwXHU2M0NGXHU4RkYwXHU4RjZDXHU2MjEwXHU3RUQzXHU2Nzg0XHU1MzE2XHU3Njg0XHU1QjlBXHU0RjREXHU1M0MyXHU2NTcwXHUzMDAyXG4gKiBcdTUwMUZcdTkyNzQgU3RhZ2VoYW5kIFx1NzY4NCBBSSBMb2NhdG9yIFx1NEUwRSBCcm93c2VyLVVzZSBcdTc2ODRcdThCRURcdTRFNDlcdTVCOUFcdTRGNERcdTMwMDJcbiAqL1xuaW1wb3J0IHR5cGUgeyBQYWdlU25hcHNob3QgfSBmcm9tIFwiQG9wZW5saXVsYW4vY29yZVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlbWFudGljTG9jYXRlUmVzdWx0IHtcbiAgLyoqIFx1NTQ3RFx1NEUyRFx1NzY4NFx1NUZFQlx1NzE2N1x1NUYxNVx1NzUyOCAqL1xuICByZWY/OiBzdHJpbmc7XG4gIC8qKiBcdTU0N0RcdTRFMkRcdTc2ODRcdTY1ODdcdTY3MkMgKi9cbiAgdGV4dD86IHN0cmluZztcbiAgLyoqIENTUyBcdTkwMDlcdTYyRTlcdTU2NjhcdUZGMDhcdTgyRTVcdTUzRUZcdTc1MjhcdUZGMDkgKi9cbiAgc2VsZWN0b3I/OiBzdHJpbmc7XG4gIC8qKiBcdTU0N0RcdTRFMkRcdTUyMDZcdTY1NzAgKi9cbiAgc2NvcmU6IG51bWJlcjtcbiAgLyoqIFx1OEJGNFx1NjYwRSAqL1xuICBub3RlOiBzdHJpbmc7XG59XG5cbmNvbnN0IElHTk9SRV9XT1JEUyA9IG5ldyBTZXQoW1wiXHU4QkY3XCIsIFwiXHU3MEI5XHU1MUZCXCIsIFwiXHU4RjkzXHU1MTY1XCIsIFwiXHU5MDA5XHU2MkU5XCIsIFwiXHU2MjdFXHU1MjMwXCIsIFwiXHU5MEEzXHU0RTJBXCIsIFwiXHU4RkQ5XHU0RTJBXCIsIFwiXHU3Njg0XCIsIFwiXHU2MzA5XHU5NEFFXCIsIFwiXHU5NEZFXHU2M0E1XCIsIFwidGhlXCIsIFwiY2xpY2tcIiwgXCJidXR0b25cIiwgXCJsaW5rXCIsIFwicGxlYXNlXCJdKTtcblxuLyoqIFx1NEVDRVx1NUZFQlx1NzE2N1x1NzY4NFx1NTNFRlx1NEVBNFx1NEU5Mlx1NTE0M1x1N0QyMFx1NEUyRFx1RkYwQ1x1NjMwOVx1OEJFRFx1NEU0OVx1NzZGOFx1NEYzQ1x1NUVBNlx1NjdFNVx1NjI3RVx1NjcwMFx1NEY3M1x1NzZFRVx1NjgwNyAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvY2F0ZUJ5U2VtYW50aWMoc25hcHNob3Q6IFBhZ2VTbmFwc2hvdCwgc2VtYW50aWM6IHN0cmluZyk6IFNlbWFudGljTG9jYXRlUmVzdWx0IHtcbiAgY29uc3QgcSA9IG5vcm1hbGl6ZShzZW1hbnRpYyk7XG4gIC8vIFx1NEUyRFx1NjU4N1x1NjVFMFx1N0E3QVx1NjgzQ1x1NTIwNlx1OEJDRFx1RkYxQVx1NjI4QSBDSksgXHU4RkRFXHU3RUVEXHU0RTMyXHU2MkM2XHU2MjEwXHU1MzU1XHU0RTJBXHU2QzQ5XHU1QjU3XHU1M0MyXHU0RTBFXHU1MzM5XHU5MTREXHVGRjFCXHU4MkYxXHU2NTg3L1x1NjU3MFx1NUI1N1x1NjMwOVx1N0E3QVx1NjgzQ1x1NTIwNlx1OEJDRFxuICBjb25zdCBxVG9rZW5zID0gdG9rZW5pemUocSk7XG5cbiAgbGV0IGJlc3Q6IFNlbWFudGljTG9jYXRlUmVzdWx0ID0geyBzY29yZTogMCwgbm90ZTogXCJcdTY3MkFcdTYyN0VcdTUyMzBcdTUzMzlcdTkxNERcIiB9O1xuXG4gIGZvciAoY29uc3QgZWwgb2Ygc25hcHNob3QuaW50ZXJhY3RpdmUpIHtcbiAgICBjb25zdCB0YXJnZXRUZXh0ID0gbm9ybWFsaXplKGVsLnRleHQpO1xuICAgIC8vIFx1NzZGNFx1NjNBNVx1NTMwNVx1NTQyQlxuICAgIGlmICh0YXJnZXRUZXh0ICYmIHRhcmdldFRleHQuaW5jbHVkZXMocSkpIHtcbiAgICAgIGNvbnN0IHNjb3JlID0gMTAwICsgcS5sZW5ndGg7XG4gICAgICBpZiAoc2NvcmUgPiBiZXN0LnNjb3JlKSBiZXN0ID0geyByZWY6IGVsLnJlZiwgdGV4dDogZWwudGV4dCwgc2VsZWN0b3I6IGVsLnNlbGVjdG9yLCBzY29yZSwgbm90ZTogXCJcdTY1ODdcdTY3MkNcdTUzMDVcdTU0MkJcdTUzMzlcdTkxNERcIiB9O1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFx1OEJDRFx1NTE0M1x1OTFDRFx1NTNFMFx1RkYwOFx1ODJGMVx1NjU4N1x1NjMwOVx1OEJDRFx1MzAwMVx1NEUyRFx1NjU4N1x1NjMwOVx1NUI1N1x1RkYwOVxuICAgIGNvbnN0IHRhcmdldFRva2VucyA9IHRva2VuaXplKHRhcmdldFRleHQpO1xuICAgIGNvbnN0IG1lYW5pbmdmdWxRID0gcVRva2Vucy5maWx0ZXIoaXNNZWFuaW5nZnVsKTtcbiAgICBjb25zdCBtZWFuaW5nZnVsVGFyZ2V0ID0gdGFyZ2V0VG9rZW5zLmZpbHRlcihpc01lYW5pbmdmdWwpO1xuICAgIGlmICghbWVhbmluZ2Z1bFRhcmdldC5sZW5ndGgpIGNvbnRpbnVlO1xuICAgIGNvbnN0IG92ZXJsYXAgPSBtZWFuaW5nZnVsUS5maWx0ZXIoKHcpID0+IG1lYW5pbmdmdWxUYXJnZXQuaW5jbHVkZXModykpLmxlbmd0aDtcbiAgICBjb25zdCBzY29yZSA9IE1hdGgucm91bmQoKG92ZXJsYXAgLyBNYXRoLm1heChtZWFuaW5nZnVsUS5sZW5ndGgsIDEpKSAqIDEwMCk7XG4gICAgaWYgKHNjb3JlID4gMCAmJiBzY29yZSA+IGJlc3Quc2NvcmUpIHtcbiAgICAgIGJlc3QgPSB7IHJlZjogZWwucmVmLCB0ZXh0OiBlbC50ZXh0LCBzZWxlY3RvcjogZWwuc2VsZWN0b3IsIHNjb3JlLCBub3RlOiBcIlx1OEJDRFx1NTE0M1x1OTFDRFx1NTNFMFx1NTMzOVx1OTE0RFwiIH07XG4gICAgfVxuICB9XG4gIHJldHVybiBiZXN0O1xufVxuXG4vKiogXHU1MjA2XHU4QkNEXHVGRjFBXHU4MkYxXHU2NTg3XHU2MzA5XHU3QTdBXHU3NjdEXHU1MjA3XHU1MjA2XHVGRjBDXHU0RTJEXHU2NTg3IENKSyBcdTYzMDlcdTUzNTVcdTRFMkFcdTVCNTdcdTdCMjZcdTUyMDdcdTUyMDYgKi9cbmZ1bmN0aW9uIHRva2VuaXplKHM6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3QgdG9rZW5zOiBzdHJpbmdbXSA9IFtdO1xuICAvLyBcdTYzRDBcdTUzRDZcdTgyRjFcdTY1ODdcdTUzNTVcdThCQ0RcdTU0OENcdTY1NzBcdTVCNTdcbiAgZm9yIChjb25zdCBtIG9mIHMubWF0Y2hBbGwoL1thLXowLTldKy9naSkpIHRva2Vucy5wdXNoKG1bMF0pO1xuICAvLyBcdTYzRDBcdTUzRDZcdThGREVcdTdFRUQgQ0pLIFx1NUI1N1x1N0IyNlx1NEUzMlx1RkYwQ1x1OTAxMFx1NUI1N1x1NjJDNlx1NTIwNlxuICBmb3IgKGNvbnN0IG0gb2Ygcy5tYXRjaEFsbCgvW1xcdTRlMDAtXFx1OWZmZl0rL2cpKSB7XG4gICAgZm9yIChjb25zdCBjaCBvZiBtWzBdKSB0b2tlbnMucHVzaChjaCk7XG4gIH1cbiAgcmV0dXJuIHRva2Vucztcbn1cblxuLyoqIFx1NjcwOVx1NjEwRlx1NEU0OVx1OEJDRFx1NTE0M1x1RkYxQVx1OTc1RVx1NUZGRFx1NzU2NVx1OEJDRFx1RkYwQ1x1NEUxNFx1RkYwOENKSyBcdTUzNTVcdTVCNTdcdTYyMTZcdTk1N0ZcdTVFQTY+MSBcdTc2ODRcdTgyRjFcdTY1ODcvXHU2NTcwXHU1QjU3XHVGRjA5ICovXG5mdW5jdGlvbiBpc01lYW5pbmdmdWwodzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmIChJR05PUkVfV09SRFMuaGFzKHcpKSByZXR1cm4gZmFsc2U7XG4gIC8vIENKSyBcdTUzNTVcdTVCNTdcdUZGMDhcdTk1N0ZcdTVFQTYgMSBcdTRFMTRcdTRFM0FcdTZDNDlcdTVCNTdcdUZGMDlcdTRGRERcdTc1NTlcbiAgaWYgKC9eW1xcdTRlMDAtXFx1OWZmZl0kLy50ZXN0KHcpKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIHcubGVuZ3RoID4gMTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW1x1RkYwQ1x1MzAwMlx1RkYwMVx1RkYxRlx1MzAwMVx1RkYxQlx1RkYxQVwiXCInJ1x1RkYwOFx1RkYwOSgpXS9nLCBcIiBcIikudHJpbSgpO1xufVxuXG4vKiogXHU4Rjg1XHU1MkE5XHVGRjFBXHU2Nzg0XHU5MDIwXHU1RTI2XHU4QkVEXHU0RTQ5XHU3Njg0IGNsaWNrIFx1NTJBOFx1NEY1Q1x1NTNDMlx1NjU3MCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlbWFudGljVG9Mb2NhdGVQYXJhbXMocmVzdWx0OiBTZW1hbnRpY0xvY2F0ZVJlc3VsdCkge1xuICByZXR1cm4ge1xuICAgIHJlZjogcmVzdWx0LnJlZixcbiAgICB0ZXh0OiByZXN1bHQudGV4dCxcbiAgICBzZWxlY3RvcjogcmVzdWx0LnNlbGVjdG9yLFxuICB9O1xufVxuIiwgIi8qKlxyXG4gKiBAb3BlbmxpdWxhbi9zdGVhbHRoIFx1MjAxNFx1MjAxNCBcdTk2MzJcdTY4QzBcdTZENEJcdTZBMjFcdTU3NTdcdUZGMDhBbnRpLURldGVjdGlvbiAvIFN0ZWFsdGhcdUZGMDlcclxuICpcclxuICogXHU3NkVFXHU2ODA3XHU3NTI4XHU2MjM3XHVGRjFBXHU4M0I3XHU1M0Q2XHU1MTZDXHU1RjAwXHU2NTcwXHU2MzZFXHU3Njg0XHU3NTI4XHU2MjM3XHVGRjA4XHU3MjJDXHU1M0Q2L1x1OTFDN1x1OTZDNlx1RkYwOVx1RkYwQ1x1OTA3Rlx1NTE0RFx1ODhBQlx1NzZFRVx1NjgwN1x1N0FEOVx1NzBCOVx1NTIyNFx1NUI5QVx1NEUzQVx1NzIyQ1x1ODY2Qlx1ODAwQ1x1OTY1MFx1OTAxRi9cdTVDMDFcdTc5ODFcdTMwMDJcclxuICpcclxuICogXHU4MEZEXHU1MjlCXHU1MjA2XHU1QzQyXHVGRjFBXHJcbiAqIC0gKipcdTUzQ0RcdTYzMDdcdTdFQjlcdTZDRThcdTUxNjUqKlx1RkYwOGluaXRTY3JpcHRcdUZGMDlcdUZGMUFcdTk2OTBcdTg1Q0Ygd2ViZHJpdmVyIFx1NjgwN1x1NUZEN1x1MzAwMVx1NEYyQVx1ODhDNVx1NjNEMlx1NEVGNi9cdThCRURcdThBMDAvXHU2NzQzXHU5NjUwXHU3QjQ5XHU2MzA3XHU3RUI5XHVGRjFCXHJcbiAqIC0gKipcdTU0MkZcdTUyQThcdTUzQzJcdTY1NzAqKlx1RkYxQVx1OTY0NFx1NTJBMCBDaHJvbWUgXHU1NDJGXHU1MkE4XHU1M0MyXHU2NTcwXHVGRjA4XHU3OTgxXHU3NTI4XHU4MUVBXHU1MkE4XHU1MzE2XHU2M0E3XHU1MjM2XHUzMDAxXHU3OTgxXHU3NTI4XHU4NEREXHU3MjU5L1x1OUVEOFx1OEJBNFx1NkQ0Rlx1ODlDOFx1NTY2OFx1NjhDMFx1NjdFNVx1N0I0OVx1RkYwOVx1RkYxQlxyXG4gKiAtICoqXHU0RUJBXHU3QzdCXHU4ODRDXHU0RTNBXHU2QTIxXHU2MkRGKipcdUZGMUFcdTlGMjBcdTY4MDdcdTc5RkJcdTUyQThcdThGNjhcdThGRjlcdTMwMDFcdThGOTNcdTUxNjVcdTVFRjZcdThGREZcdTMwMDFcdTZFREFcdTUyQThcdTk2OEZcdTY3M0FcdTUzMTZcdUZGMDhcdThCQTlcdTRFQkFcdTVERTVcdTY0Q0RcdTRGNUNcdTcyNzlcdTVGODFcdTRFMERcdTUzRUZcdThGQThcdThCQzZcdUZGMDlcdUZGMUJcclxuICogLSAqKlVzZXItQWdlbnQgXHU3QjU2XHU3NTY1KipcdUZGMUFcdTUzRUZcdTkxNERcdTdGNkVcdTc3MUZcdTVCOUVcdTZENEZcdTg5QzhcdTU2NjggVUFcdUZGMENcdTgxRUFcdTUyQThcdThGNkVcdTYzNjJcdTMwMDJcclxuICpcclxuICogXHU4QkJFXHU4QkExXHU1MzlGXHU1MjE5XHVGRjFBXHJcbiAqIC0gXHU3RUFGIEpTIFx1NkNFOFx1NTE2NVx1NEUzQVx1NEUzQlx1RkYwOFx1NEUwRFx1NEY5RFx1OEQ1NiBwdXBwZXRlZXItZXh0cmEgXHU3QjQ5XHU5MUNEXHU1NzhCXHU1RTkzXHVGRjA5XHVGRjBDXHU5NkY2XHU1OTE2XHU5MEU4XHU0RjlEXHU4RDU2XHU1MzczXHU1M0VGXHU1REU1XHU0RjVDXHVGRjFCXHJcbiAqIC0gXHU1M0VGXHU5MDA5XHU2MkU5XHU2MDI3XHU1NDJGXHU3NTI4XHVGRjA4c3RlYWx0aCBcdTlFRDhcdThCQTRcdTUxNzNcdTk1RURcdUZGMENcdTRFQzVcdTU3MjhcdTc1MjhcdTYyMzdcdTU4RjBcdTY2MEVcdTk3MDBcdTg5ODFcdTY1RjZcdTVGMDBcdTU0MkZcdUZGMENcdTkwN0ZcdTUxNERcdTY1RTBcdThDMTNcdTRGQjVcdTUxNjVcdUZGMDlcdUZGMUJcclxuICogLSBcdTRFMEVcdTczQjBcdTY3MDkgUGxheXdyaWdodEVuZ2luZSBcdTY1RTBcdTdGMURcdTk2QzZcdTYyMTBcdUZGMUFcdTkwMUFcdThGQzcgYGluaXRTY3JpcHRgIFx1NkNFOFx1NTE2NSArIGBsYXVuY2hPcHRpb25zYCBcdTc1MUZcdTY1NDhcdTMwMDJcclxuICovXHJcblxyXG4vKipcclxuICogU3RlYWx0aCBcdTkxNERcdTdGNkVcdTk4NzlcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3RlYWx0aE9wdGlvbnMge1xyXG4gIC8qKiBcdTY2MkZcdTU0MjZcdTU0MkZcdTc1Mjggc3RlYWx0aFx1RkYwOFx1OUVEOFx1OEJBNCBmYWxzZSBcdTIwMTRcdTIwMTQgXHU0RUM1XHU1NzI4XHU3NTI4XHU2MjM3XHU2NjBFXHU3ODZFXHU4OTgxXHU2QzQyXHU2NUY2XHU1RjAwXHU1NDJGXHVGRjA5ICovXHJcbiAgZW5hYmxlZD86IGJvb2xlYW47XHJcbiAgLyoqIFx1NTNDRFx1NjMwN1x1N0VCOVx1NkNFOFx1NTE2NVx1N0VBN1x1NTIyQlx1RkYxQWJhc2ljPVx1OTY5MFx1ODVDRiB3ZWJkcml2ZXJcdUZGMUJmdWxsPVx1NUI4Q1x1NjU3NFx1NTNDRFx1NjMwN1x1N0VCOVx1RkYwOFx1OUVEOFx1OEJBNCBiYXNpY1x1RkYwOSAqL1xyXG4gIGxldmVsPzogXCJiYXNpY1wiIHwgXCJmdWxsXCI7XHJcbiAgLyoqIFx1NzUyOFx1NjIzN1x1NEVFM1x1NzQwNlx1RkYwOFx1NzU1OVx1N0E3QVx1NTIxOVx1NEUwRFx1ODk4Nlx1NzZENiBVQVx1RkYwQ1x1NEY3Rlx1NzUyOFx1NkQ0Rlx1ODlDOFx1NTY2OFx1OUVEOFx1OEJBNFx1RkYwOSAqL1xyXG4gIHVzZXJBZ2VudD86IHN0cmluZztcclxuICAvKiogXHU0RUJBXHU3QzdCXHU4ODRDXHU0RTNBXHU2QTIxXHU2MkRGXHVGRjFBXHU4RjkzXHU1MTY1XHU1RUY2XHU4RkRGXHU1MzNBXHU5NUY0IFttaW4sIG1heF0gbXNcdUZGMDhcdTlFRDhcdThCQTQgWzMwLCA5MF1cdUZGMDkgKi9cclxuICBodW1hblR5cGluZ0RlbGF5PzogW251bWJlciwgbnVtYmVyXTtcclxuICAvKiogXHU0RUJBXHU3QzdCXHU4ODRDXHU0RTNBXHU2QTIxXHU2MkRGXHVGRjFBXHU1MkE4XHU0RjVDXHU5NUY0XHU5NjhGXHU2NzNBXHU5NUY0XHU5Njk0IFttaW4sIG1heF0gbXNcdUZGMDhcdTlFRDhcdThCQTQgWzIwMCwgNjAwXVx1RkYwOSAqL1xyXG4gIGh1bWFuQWN0aW9uRGVsYXk/OiBbbnVtYmVyLCBudW1iZXJdO1xyXG4gIC8qKiBcdTlGMjBcdTY4MDdcdTc5RkJcdTUyQThcdTY2MkZcdTU0MjZcdTZBMjFcdTYyREZcdTRFQkFcdTdDN0JcdThGNjhcdThGRjlcdUZGMDhcdTlFRDhcdThCQTQgdHJ1ZVx1RkYwOSAqL1xyXG4gIGh1bWFuTW91c2VUcmFqZWN0b3J5PzogYm9vbGVhbjtcclxuICAvKiogXHU5ODlEXHU1OTE2XHU4MUVBXHU1QjlBXHU0RTQ5XHU1NDJGXHU1MkE4XHU1M0MyXHU2NTcwICovXHJcbiAgZXh0cmFBcmdzPzogc3RyaW5nW107XHJcbn1cclxuXHJcbi8qKiBcdTlFRDhcdThCQTRcdTkxNERcdTdGNkUgKi9cclxuY29uc3QgREVGQVVMVFM6IFJlcXVpcmVkPFBpY2s8U3RlYWx0aE9wdGlvbnMsIFwibGV2ZWxcIiB8IFwiaHVtYW5UeXBpbmdEZWxheVwiIHwgXCJodW1hbkFjdGlvbkRlbGF5XCIgfCBcImh1bWFuTW91c2VUcmFqZWN0b3J5XCI+PiAmIFBpY2s8U3RlYWx0aE9wdGlvbnMsIFwidXNlckFnZW50XCIgfCBcImV4dHJhQXJnc1wiPiA9IHtcclxuICBsZXZlbDogXCJiYXNpY1wiLFxyXG4gIGh1bWFuVHlwaW5nRGVsYXk6IFszMCwgOTBdLFxyXG4gIGh1bWFuQWN0aW9uRGVsYXk6IFsyMDAsIDYwMF0sXHJcbiAgaHVtYW5Nb3VzZVRyYWplY3Rvcnk6IHRydWUsXHJcbiAgdXNlckFnZW50OiB1bmRlZmluZWQsXHJcbiAgZXh0cmFBcmdzOiBbXSxcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdGVhbHRoTWFuYWdlciBcdTIwMTRcdTIwMTQgXHU5NjMyXHU2OEMwXHU2RDRCXHU2QTIxXHU1NzU3XHU1MTY1XHU1M0UzXHJcbiAqXHJcbiAqIFx1NjNEMFx1NEY5Qlx1RkYxQVxyXG4gKiAtIGBidWlsZExhdW5jaE9wdGlvbnMoKWAgIFx1MjE5MiBcdTZENEZcdTg5QzhcdTU2NjhcdTU0MkZcdTUyQThcdTUzQzJcdTY1NzBcdUZGMDhcdTU0MkJcdTUzQ0RcdTgxRUFcdTUyQThcdTUzMTYgZmxhZ3NcdUZGMDlcclxuICogLSBgYnVpbGRJbml0U2NyaXB0KClgICAgICBcdTIxOTIgXHU1M0NEXHU2MzA3XHU3RUI5XHU2Q0U4XHU1MTY1XHU4MTFBXHU2NzJDXHVGRjA4XHU1NzI4XHU5ODc1XHU5NzYyXHU1MjFCXHU1RUZBXHU1MjREXHU2Q0U4XHU1MTY1XHVGRjA5XHJcbiAqIC0gYGh1bWFuaXplKClgICAgICAgICAgICAgXHUyMTkyIFx1NEVCQVx1N0M3Qlx1ODg0Q1x1NEUzQVx1NkEyMVx1NjJERlx1ODhDNVx1OTk3MFx1NTY2OFx1RkYwOFx1NzUyOFx1NEU4RVx1NTJBOFx1NEY1Q1x1NjI2N1x1ODg0Q1x1RkYwOVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFN0ZWFsdGhNYW5hZ2VyIHtcclxuICByZWFkb25seSBvcHRpb25zOiBSZXF1aXJlZDxPbWl0PFN0ZWFsdGhPcHRpb25zLCBcInVzZXJBZ2VudFwiIHwgXCJleHRyYUFyZ3NcIj4+ICYgUGljazxTdGVhbHRoT3B0aW9ucywgXCJ1c2VyQWdlbnRcIiB8IFwiZXh0cmFBcmdzXCI+O1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBTdGVhbHRoT3B0aW9ucyA9IHt9KSB7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSB7XHJcbiAgICAgIGVuYWJsZWQ6IG9wdGlvbnMuZW5hYmxlZCA/PyBmYWxzZSxcclxuICAgICAgbGV2ZWw6IG9wdGlvbnMubGV2ZWwgPz8gREVGQVVMVFMubGV2ZWwsXHJcbiAgICAgIHVzZXJBZ2VudDogb3B0aW9ucy51c2VyQWdlbnQgPz8gREVGQVVMVFMudXNlckFnZW50LFxyXG4gICAgICBodW1hblR5cGluZ0RlbGF5OiBvcHRpb25zLmh1bWFuVHlwaW5nRGVsYXkgPz8gREVGQVVMVFMuaHVtYW5UeXBpbmdEZWxheSxcclxuICAgICAgaHVtYW5BY3Rpb25EZWxheTogb3B0aW9ucy5odW1hbkFjdGlvbkRlbGF5ID8/IERFRkFVTFRTLmh1bWFuQWN0aW9uRGVsYXksXHJcbiAgICAgIGh1bWFuTW91c2VUcmFqZWN0b3J5OiBvcHRpb25zLmh1bWFuTW91c2VUcmFqZWN0b3J5ID8/IERFRkFVTFRTLmh1bWFuTW91c2VUcmFqZWN0b3J5LFxyXG4gICAgICBleHRyYUFyZ3M6IG9wdGlvbnMuZXh0cmFBcmdzID8/IERFRkFVTFRTLmV4dHJhQXJncyxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKiogXHU2NjJGXHU1NDI2XHU1NDJGXHU3NTI4ICovXHJcbiAgZ2V0IGlzRW5hYmxlZCgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZW5hYmxlZDtcclxuICB9XHJcblxyXG4gIC8qKiBcdTZENEZcdTg5QzhcdTU2NjhcdTU0MkZcdTUyQThcdTUzQzJcdTY1NzBcdUZGMDhcdTRFQzVcdTVGNTNcdTU0MkZcdTc1MjhcdTY1RjZcdThGRDRcdTU2REVcdUZGMENcdTU0MjZcdTUyMTlcdThGRDRcdTU2REVcdTdBN0FcdTY1NzBcdTdFQzRcdUZGMENcdTRGRERcdTYzMDFcdTlFRDhcdThCQTRcdTVFNzJcdTUxQzBcdUZGMDkgKi9cclxuICBidWlsZExhdW5jaEFyZ3MoKTogc3RyaW5nW10ge1xyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZW5hYmxlZCkgcmV0dXJuIFtdO1xyXG4gICAgY29uc3QgYXJncyA9IFtcclxuICAgICAgLy8gXHU3OTgxXHU3NTI4XHU4MUVBXHU1MkE4XHU1MzE2XHU2M0E3XHU1MjM2XHU2ODA3XHU1RkQ3XHVGRjA4XHU4RkQ5XHU2NjJGXHU2NzAwXHU5MUNEXHU4OTgxXHU3Njg0XHU1M0NEXHU2OEMwXHU2RDRCXHU3MEI5XHVGRjA5XHJcbiAgICAgIFwiLS1kaXNhYmxlLWJsaW5rLWZlYXR1cmVzPUF1dG9tYXRpb25Db250cm9sbGVkXCIsXHJcbiAgICAgIFwiLS1kaXNhYmxlLWJsaW5rLWZlYXR1cmVzPUF1dG9tYXRpb25Db250cm9sbGVkLElkbGVEZXRlY3Rpb25cIixcclxuICAgICAgLy8gXHU3OUZCXHU5NjY0XHU4MUVBXHU1MkE4XHU1MzE2XHU3NkY4XHU1MTczXHU3Njg0XHU5RUQ4XHU4QkE0XHU4ODRDXHU0RTNBXHJcbiAgICAgIFwiLS1kaXNhYmxlLWF1dG9tYXRpb25cIixcclxuICAgICAgXCItLW5vLWZpcnN0LXJ1blwiLFxyXG4gICAgICBcIi0tbm8tZGVmYXVsdC1icm93c2VyLWNoZWNrXCIsXHJcbiAgICAgIFwiLS1kaXNhYmxlLWRlZmF1bHQtYXBwc1wiLFxyXG4gICAgICBcIi0tZGlzYWJsZS1leHRlbnNpb25zLWV4Y2VwdD0vZGV2L251bGxcIixcclxuICAgICAgXCItLWRpc2FibGUtYmFja2dyb3VuZC1uZXR3b3JraW5nXCIsXHJcbiAgICAgIFwiLS1kaXNhYmxlLXN5bmNcIixcclxuICAgICAgXCItLWRpc2FibGUtY29tcG9uZW50LXVwZGF0ZVwiLFxyXG4gICAgICBcIi0tZGlzYWJsZS1kb21haW4tcmVsaWFiaWxpdHlcIixcclxuICAgICAgXCItLWRpc2FibGUtY2xpZW50LXNpZGUtcGhpc2hpbmctZGV0ZWN0aW9uXCIsXHJcbiAgICAgIC8vIFx1Nzk4MVx1NzUyOFx1NjVFMFx1NTkzNFx1NkEyMVx1NUYwRlx1NzI3OVx1NjcwOVx1NzY4NFx1NTNFRlx1NjhDMFx1NkQ0Qlx1NzI3OVx1NUY4MVxyXG4gICAgICBcIi0tZGlzYWJsZS1pbmZvYmFyc1wiLFxyXG4gICAgICBcIi0tZGlzYWJsZS1mZWF0dXJlcz1Jc29sYXRlT3JpZ2lucyxzaXRlLXBlci1wcm9jZXNzXCIsXHJcbiAgICAgIFwiLS13aW5kb3ctcG9zaXRpb249MCwwXCIsXHJcbiAgICAgIFwiLS1sYW5nPWVuLVVTLGVuXCIsXHJcbiAgICBdO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5leHRyYUFyZ3M/Lmxlbmd0aCkgYXJncy5wdXNoKC4uLnRoaXMub3B0aW9ucy5leHRyYUFyZ3MpO1xyXG4gICAgcmV0dXJuIGFyZ3M7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBcdTUzQ0RcdTYzMDdcdTdFQjlcdTZDRThcdTUxNjVcdTgxMUFcdTY3MkMgXHUyMDE0XHUyMDE0IFx1NTcyOFx1OTg3NVx1OTc2Mlx1NEUwQVx1NEUwQlx1NjU4N1x1NEUyRFx1NjI2N1x1ODg0Q1x1RkYwQ1x1NzUyOFx1NEU4RVx1NEYyQVx1ODhDNVx1NkQ0Rlx1ODlDOFx1NTY2OFx1NjMwN1x1N0VCOVx1MzAwMlxyXG4gICAqIFx1OEZENFx1NTZERVx1NzY4NFx1ODExQVx1NjcyQ1x1NEYxQVx1NTcyOFx1NkJDRlx1NEUyQVx1NjVCMFx1OTg3NVx1OTc2Mlx1NTIxQlx1NUVGQVx1NjVGNlx1NkNFOFx1NTE2NVx1MzAwMlxyXG4gICAqL1xyXG4gIGJ1aWxkSW5pdFNjcmlwdCgpOiBzdHJpbmcge1xyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZW5hYmxlZCkgcmV0dXJuIFwiXCI7XHJcbiAgICByZXR1cm4gYCgoKSA9PiB7XHJcbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIDEuIFx1OTY5MFx1ODVDRiBuYXZpZ2F0b3Iud2ViZHJpdmVyXHVGRjA4XHU2NzAwXHU3RUNGXHU1MTc4XHU3Njg0XHU2OEMwXHU2RDRCXHU3MEI5XHVGRjA5IFx1MjUwMFx1MjUwMFx1MjUwMFxyXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuYXZpZ2F0b3IsICd3ZWJkcml2ZXInLCB7IGdldDogKCkgPT4gdW5kZWZpbmVkIH0pO1xyXG5cclxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgMi4gXHU0RjJBXHU4OEM1IHBsdWdpbnNcdUZGMDhcdTc3MUZcdTVCOUVcdTZENEZcdTg5QzhcdTU2NjhcdTkwMUFcdTVFMzhcdTY3MDkgUERGIFx1NjdFNVx1NzcwQlx1NTY2OFx1N0I0OVx1NjNEMlx1NEVGNlx1RkYwOSBcdTI1MDBcdTI1MDBcdTI1MDBcclxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmF2aWdhdG9yLCAncGx1Z2lucycsIHtcclxuICAgIGdldDogKCkgPT4ge1xyXG4gICAgICBjb25zdCBwbHVnaW5MaXN0ID0gW1xyXG4gICAgICAgIHsgbmFtZTogJ0Nocm9tZSBQREYgUGx1Z2luJywgZmlsZW5hbWU6ICdpbnRlcm5hbC1wZGYtdmlld2VyJywgZGVzY3JpcHRpb246ICdQb3J0YWJsZSBEb2N1bWVudCBGb3JtYXQnIH0sXHJcbiAgICAgICAgeyBuYW1lOiAnQ2hyb21lIFBERiBWaWV3ZXInLCBmaWxlbmFtZTogJ21oamZibWRnY2ZqYmJwYWVvam9mb2hvZWZnaWVoamFpJywgZGVzY3JpcHRpb246ICcnIH0sXHJcbiAgICAgICAgeyBuYW1lOiAnTmF0aXZlIENsaWVudCcsIGZpbGVuYW1lOiAnaW50ZXJuYWwtbmFjbC1wbHVnaW4nLCBkZXNjcmlwdGlvbjogJycgfVxyXG4gICAgICBdO1xyXG4gICAgICBjb25zdCByZXN1bHQgPSB7IGxlbmd0aDogcGx1Z2luTGlzdC5sZW5ndGgsIGl0ZW06IChpKSA9PiBwbHVnaW5MaXN0W2ldLCBuYW1lZEl0ZW06IChuKSA9PiBwbHVnaW5MaXN0LmZpbmQocCA9PiBwLm5hbWUgPT09IG4pIHx8IG51bGwgfTtcclxuICAgICAgZm9yIChjb25zdCBwIG9mIHBsdWdpbkxpc3QpIHJlc3VsdFtwLm5hbWVdID0gcDtcclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIDMuIFx1NEYyQVx1ODhDNSBsYW5ndWFnZXNcdUZGMDhcdTRFMEVcdTc3MUZcdTVCOUUgQ2hyb21lIFx1NUJGOVx1OUY1MFx1RkYwOSBcdTI1MDBcdTI1MDBcdTI1MDBcclxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmF2aWdhdG9yLCAnbGFuZ3VhZ2VzJywgeyBnZXQ6ICgpID0+IFsnZW4tVVMnLCAnZW4nLCAnemgtQ04nXSB9KTtcclxuXHJcbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIDQuIFx1OTY5MFx1ODVDRiBBdXRvbWF0aW9uQ29udHJvbGxlZCBcdTc1RDVcdThGRjkgXHUyNTAwXHUyNTAwXHUyNTAwXHJcbiAgaWYgKHdpbmRvdy5jaHJvbWUpIHtcclxuICAgIC8vIFx1Nzg2RVx1NEZERCBjaHJvbWUucnVudGltZSBcdTVCNThcdTU3MjhcdUZGMDhcdTc3MUZcdTVCOUVcdTZENEZcdTg5QzhcdTU2NjhcdTRFMkRcdThCRTVcdTVCRjlcdThDNjFcdTVCNThcdTU3MjhcdUZGMDlcclxuICAgIGlmICghd2luZG93LmNocm9tZS5ydW50aW1lKSB7XHJcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh3aW5kb3cuY2hyb21lLCAncnVudGltZScsIHsgdmFsdWU6IHt9IH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIDUuIFx1NEZFRVx1NjUzOSBwZXJtaXNzaW9ucyBcdTYyQTVcdTU0NEFcdUZGMDhcdTkwN0ZcdTUxNERcdThGRDRcdTU2REUgZGVuaWVkIFx1ODhBQlx1OEJDNlx1NTIyQlx1RkYwOSBcdTI1MDBcdTI1MDBcdTI1MDBcclxuICBjb25zdCBvcmlnaW5hbFF1ZXJ5ID0gd2luZG93Lm5hdmlnYXRvci5wZXJtaXNzaW9ucyAmJiB3aW5kb3cubmF2aWdhdG9yLnBlcm1pc3Npb25zLnF1ZXJ5O1xyXG4gIGlmIChvcmlnaW5hbFF1ZXJ5KSB7XHJcbiAgICB3aW5kb3cubmF2aWdhdG9yLnBlcm1pc3Npb25zLnF1ZXJ5ID0gKHBhcmFtZXRlcnMpID0+IChcclxuICAgICAgcGFyYW1ldGVycyAmJiBwYXJhbWV0ZXJzLm5hbWUgPT09ICdub3RpZmljYXRpb25zJ1xyXG4gICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHsgc3RhdGU6IE5vdGlmaWNhdGlvbi5wZXJtaXNzaW9uIH0pXHJcbiAgICAgICAgOiBvcmlnaW5hbFF1ZXJ5KHBhcmFtZXRlcnMpXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIDYuIFx1NTE2OFx1N0VBNyBzdGVhbHRoXHVGRjFBXHU2NkY0XHU1OTFBXHU2MzA3XHU3RUI5XHU0RjJBXHU4OEM1IFx1MjUwMFx1MjUwMFx1MjUwMFxyXG4gICR7dGhpcy5vcHRpb25zLmxldmVsID09PSBcImZ1bGxcIiA/IGBcclxuICAvLyBcdTRGMkFcdTg4QzUgY29uc29sZS5kZWJ1ZyBcdTRFMERcdTRFQTdcdTc1MUZcdTU1MkZcdTRFMDBcdThDMDNcdTc1MjhcdTY4MDhcclxuICAvLyBcdTRGMkFcdTg4QzUgd2luZG93Lm91dGVyV2lkdGgvb3V0ZXJIZWlnaHRcdUZGMDhoZWFkbGVzcyBcdTZENEZcdTg5QzhcdTU2NjhcdTdBOTdcdTUzRTNcdTVDM0FcdTVCRjhcdTVERUVcdTVGMDJcdUZGMDlcclxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCAnb3V0ZXJXaWR0aCcsIHsgZ2V0OiAoKSA9PiB3aW5kb3cuaW5uZXJXaWR0aCB8fCAxOTIwIH0pO1xyXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh3aW5kb3csICdvdXRlckhlaWdodCcsIHsgZ2V0OiAoKSA9PiB3aW5kb3cuaW5uZXJIZWlnaHQgfHwgMTA4MCB9KTtcclxuXHJcbiAgLy8gXHU0RjJBXHU4OEM1IHNjcmVlbiBcdTUzQzJcdTY1NzBcclxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LnNjcmVlbiwgJ2NvbG9yRGVwdGgnLCB7IGdldDogKCkgPT4gMjQgfSk7XHJcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdy5zY3JlZW4sICdwaXhlbERlcHRoJywgeyBnZXQ6ICgpID0+IDI0IH0pO1xyXG5cclxuICAvLyBcdTRGMkFcdTg4QzVcdTdGNkVcdTg5RTZcdTY0NzhcdTY1MkZcdTYzMDFcdUZGMDhcdTkwN0ZcdTUxNEQgaGVhZGxlc3MgXHU2OEMwXHU2RDRCXHU1MjMwXHU2NUUwXHU4OUU2XHU2NDc4XHU4MEZEXHU1MjlCXHVGRjA5XHJcbiAgaWYgKCEoJ29udG91Y2hzdGFydCcgaW4gd2luZG93KSkge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdywgJ29udG91Y2hzdGFydCcsIHsgdmFsdWU6IG51bGwgfSk7XHJcbiAgfVxyXG5cclxuICAvLyBcdTRGMkFcdTg4QzUgRGV2aWNlTWVtb3J5IFx1NTQ4QyBIYXJkd2FyZUNvbmN1cnJlbmN5XHJcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5hdmlnYXRvciwgJ2RldmljZU1lbW9yeScsIHsgZ2V0OiAoKSA9PiA4IH0pO1xyXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuYXZpZ2F0b3IsICdoYXJkd2FyZUNvbmN1cnJlbmN5JywgeyBnZXQ6ICgpID0+IDggfSk7XHJcblxyXG4gIC8vIFx1NEYyQVx1ODhDNSBXZWJHTCBcdTZFMzJcdTY3RDNcdTU2NjhcdUZGMDhcdTkwN0ZcdTUxNERcdTY2QjRcdTk3MzIgU3dpZnRTaGFkZXIgXHU3QjQ5XHU2NUUwXHU1OTM0XHU2RTMyXHU2N0QzXHU1NjY4XHVGRjA5XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGdldFBhcmFtZXRlciA9IFdlYkdMUmVuZGVyaW5nQ29udGV4dC5wcm90b3R5cGUuZ2V0UGFyYW1ldGVyO1xyXG4gICAgV2ViR0xSZW5kZXJpbmdDb250ZXh0LnByb3RvdHlwZS5nZXRQYXJhbWV0ZXIgPSBmdW5jdGlvbihwYXJhbWV0ZXIpIHtcclxuICAgICAgaWYgKHBhcmFtZXRlciA9PT0gMzc0NDUpIHJldHVybiAnR29vZ2xlIEluYy4gKE5WSURJQSknO1xyXG4gICAgICBpZiAocGFyYW1ldGVyID09PSAzNzQ0NikgcmV0dXJuICdBTkdMRSAoTlZJRElBLCBOVklESUEgR2VGb3JjZSBSVFggMzA2MCBEaXJlY3QzRDExIHZzXzVfMCBwc181XzAsIEQzRDExKSc7XHJcbiAgICAgIHJldHVybiBnZXRQYXJhbWV0ZXIuY2FsbCh0aGlzLCBwYXJhbWV0ZXIpO1xyXG4gICAgfTtcclxuICB9IGNhdGNoIChlKSB7fVxyXG4gIGAgOiBcIlwifVxyXG59KSgpO2A7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBcdTRFQkFcdTdDN0JcdTg4NENcdTRFM0FcdTZBMjFcdTYyREYgXHUyMDE0XHUyMDE0IFx1NzUxRlx1NjIxMFx1OTY4Rlx1NjczQVx1NzY4NFx1NEVCQVx1N0M3Qlx1NTMxNlx1NTJBOFx1NEY1Q1x1OTVGNFx1OTY5NFx1MzAwMlxyXG4gICAqIFx1OEMwM1x1NzUyOFx1NjVCOVx1NTcyOFx1NTJBOFx1NEY1Q1x1NEU0Qlx1OTVGNFx1NEY3Rlx1NzUyOFx1OEJFNVx1OTVGNFx1OTY5NFx1RkYwQ1x1NkEyMVx1NjJERlx1NEVCQVx1NzY4NFx1NjRDRFx1NEY1Q1x1ODI4Mlx1NTk0Rlx1MzAwMlxyXG4gICAqL1xyXG4gIGh1bWFuRGVsYXkoKTogbnVtYmVyIHtcclxuICAgIGlmICghdGhpcy5vcHRpb25zLmVuYWJsZWQpIHJldHVybiAwO1xyXG4gICAgY29uc3QgW21pbiwgbWF4XSA9IHRoaXMub3B0aW9ucy5odW1hbkFjdGlvbkRlbGF5ITtcclxuICAgIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpICsgbWluO1xyXG4gIH1cclxuXHJcbiAgLyoqIFx1NEVCQVx1N0M3Qlx1NjI1M1x1NUI1N1x1NUVGNlx1OEZERlx1RkYwOHR5cGUgXHU1MkE4XHU0RjVDXHU2NUY2XHU5MDEwXHU5NTJFXHU0RTRCXHU5NUY0XHU3Njg0XHU5NjhGXHU2NzNBXHU5NUY0XHU5Njk0XHVGRjA5ICovXHJcbiAgaHVtYW5UeXBpbmdEZWxheU1zKCk6IG51bWJlciB7XHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5lbmFibGVkKSByZXR1cm4gMDtcclxuICAgIGNvbnN0IFttaW4sIG1heF0gPSB0aGlzLm9wdGlvbnMuaHVtYW5UeXBpbmdEZWxheSE7XHJcbiAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKSArIG1pbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFx1NzUxRlx1NjIxMFx1NEVCQVx1N0M3Qlx1NTMxNlx1NzY4NFx1OUYyMFx1NjgwN1x1NzlGQlx1NTJBOFx1OERFRlx1NUY4NFx1RkYwOFx1OEQxRFx1NTg1RVx1NUMxNFx1NjZGMlx1N0VCRlx1NjNEMlx1NTAzQ1x1RkYwOVx1MzAwMlxyXG4gICAqIFx1OEZENFx1NTZERVx1NEUwMFx1N0VDNCBbW3gseV0sIC4uLl0gXHU1NzUwXHU2ODA3XHU1RThGXHU1MjE3XHVGRjBDXHU0RjlCXHU4QzAzXHU3NTI4XHU2NUI5XHU0RjlEXHU2QjIxXHU3OUZCXHU1MkE4XHU5RjIwXHU2ODA3XHUzMDAyXHJcbiAgICovXHJcbiAgaHVtYW5Nb3VzZVBhdGgoZnJvbTogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LCB0bzogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LCBzdGVwcyA9IDEyKTogQXJyYXk8W251bWJlciwgbnVtYmVyXT4ge1xyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZW5hYmxlZCB8fCAhdGhpcy5vcHRpb25zLmh1bWFuTW91c2VUcmFqZWN0b3J5KSB7XHJcbiAgICAgIHJldHVybiBbW3RvLngsIHRvLnldXTtcclxuICAgIH1cclxuICAgIGNvbnN0IHBhdGg6IEFycmF5PFtudW1iZXIsIG51bWJlcl0+ID0gW107XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ZXBzOyBpKyspIHtcclxuICAgICAgY29uc3QgdCA9IChpICsgMSkgLyBzdGVwcztcclxuICAgICAgLy8gXHU3QjgwXHU1MzU1XHU0RThDXHU2QjIxXHU4RDFEXHU1ODVFXHU1QzE0XHVGRjBDXHU1MkEwXHU1MTY1XHU5NjhGXHU2NzNBXHU2MjcwXHU1MkE4XHU2QTIxXHU2MkRGXHU3NzFGXHU1QjlFXHU2MjRCXHU5MEU4XHU4RkQwXHU1MkE4XHJcbiAgICAgIGNvbnN0IGNvbnRyb2xYID0gKGZyb20ueCArIHRvLngpIC8gMiArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDQwO1xyXG4gICAgICBjb25zdCBjb250cm9sWSA9IE1hdGgubWluKGZyb20ueSwgdG8ueSkgLSBNYXRoLnJhbmRvbSgpICogMzA7XHJcbiAgICAgIGNvbnN0IHggPSAoMSAtIHQpICoqIDIgKiBmcm9tLnggKyAyICogKDEgLSB0KSAqIHQgKiBjb250cm9sWCArIHQgKiogMiAqIHRvLng7XHJcbiAgICAgIGNvbnN0IHkgPSAoMSAtIHQpICoqIDIgKiBmcm9tLnkgKyAyICogKDEgLSB0KSAqIHQgKiBjb250cm9sWSArIHQgKiogMiAqIHRvLnk7XHJcbiAgICAgIHBhdGgucHVzaChbTWF0aC5yb3VuZCh4KSwgTWF0aC5yb3VuZCh5KV0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbiAgfVxyXG5cclxuICAvKiogXHU3NTFGXHU2MjEwXHU1NTJGXHU0RTAwXHU3QjdFXHU1NDBEXHU2ODA3XHU4QkM2XHVGRjA4XHU3NTI4XHU0RThFXHU2ODA3XHU4QkIwIHN0ZWFsdGggXHU1RjAwXHU1NDJGXHU3MkI2XHU2MDAxXHVGRjA5ICovXHJcbiAgZ2V0IHNpZ25hdHVyZSgpOiBzdHJpbmcge1xyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZW5hYmxlZCkgcmV0dXJuIFwic3RlYWx0aC1vZmZcIjtcclxuICAgIHJldHVybiBgc3RlYWx0aDoke3RoaXMub3B0aW9ucy5sZXZlbH06dWE9JHt0aGlzLm9wdGlvbnMudXNlckFnZW50ID8gXCJjdXN0b21cIiA6IFwiZGVmYXVsdFwifWA7XHJcbiAgfVxyXG59XHJcblxyXG4vKiogXHU0RkJGXHU2Mzc3XHU1MUZEXHU2NTcwXHVGRjFBXHU1MjFCXHU1RUZBIHN0ZWFsdGggXHU3QkExXHU3NDA2XHU1NjY4ICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdGVhbHRoKG9wdGlvbnM/OiBTdGVhbHRoT3B0aW9ucyk6IFN0ZWFsdGhNYW5hZ2VyIHtcclxuICByZXR1cm4gbmV3IFN0ZWFsdGhNYW5hZ2VyKG9wdGlvbnMpO1xyXG59XHJcbiIsICIvKipcbiAqIFRva2VuIFx1OUFEOFx1NjU0OFx1NjNEMFx1NTNENlx1N0I1Nlx1NzU2NVxuICpcbiAqIFx1NTAxRlx1OTI3NCBDaHJvbWUgRGV2VG9vbHMgTUNQIFx1NzY4NCA1IFx1NjYxRiBUb2tlbiBcdTY1NDhcdTczODdcdUZGMUFcbiAqIDEuIERPTSBcdTYzMDlcdTk3MDBcdTg4QzFcdTUyNkFcdUZGMDhcdTUzRUFcdThCRkJcdTk3MDBcdTg5ODFcdTc2ODRcdTRGRTFcdTYwNkZcdUZGMDlcbiAqIDIuIFx1NTg5RVx1OTFDRlx1OEJGQlx1NTNENlx1RkYwOFx1NTE0OFx1NjQ1OFx1ODk4MVx1RkYwQ1x1NjMwOSByZWYgXHU1QzU1XHU1RjAwXHVGRjA5XG4gKiAzLiBcdTdFRDNcdTY3ODRcdTUzMTZcdTUzOEJcdTdGMjlcdThGOTNcdTUxRkFcbiAqL1xuaW1wb3J0IHR5cGUgeyBQYWdlU25hcHNob3QsIFNuYXBzaG90Tm9kZSB9IGZyb20gXCJAb3BlbmxpdWxhbi9jb3JlXCI7XG5cbi8qKiBUb2tlbiBcdTRGMzBcdTdCOTdcdUZGMUFcdTdDOTdcdTc1NjUgNCBcdTVCNTdcdTdCMjYvdG9rZW4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlc3RpbWF0ZVRva2Vucyh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5jZWlsKHRleHQubGVuZ3RoIC8gNCk7XG59XG5cbi8qKiBcdTVGRUJcdTcxNjdcdTc2ODRcdTY3MDBcdTVDMEZcdTUzMTZcdTY1ODdcdTY3MkNcdTg4NjhcdTc5M0FcdUZGMDhcdTRGOUIgTExNXHVGRjA5ICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGFjdFNuYXBzaG90KHNuYXBzaG90OiBQYWdlU25hcHNob3QsIG1heEludGVyYWN0aXZlID0gNDApOiBzdHJpbmcge1xuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgcGFydHMucHVzaChgWyR7c25hcHNob3QudGl0bGV9XSAke3NuYXBzaG90LnVybH1gKTtcbiAgY29uc3Qgcm93cyA9IHNuYXBzaG90LmludGVyYWN0aXZlLnNsaWNlKDAsIG1heEludGVyYWN0aXZlKS5tYXAoXG4gICAgKGVsKSA9PiBgJHtlbC5yZWZ9OiR7ZWwudGFnfSR7ZWwucm9sZSA/IFwiW1wiICsgZWwucm9sZSArIFwiXVwiIDogXCJcIn06XCIke2VsLnRleHQuc2xpY2UoMCwgNjApfVwiYFxuICApO1xuICBwYXJ0cy5wdXNoKHJvd3Muam9pbihcIlxcblwiKSk7XG4gIHJldHVybiBwYXJ0cy5qb2luKFwiXFxuXCIpO1xufVxuXG4vKiogXHU1MzU1XHU0RTJBXHU4MjgyXHU3MEI5XHU1MzhCXHU3RjI5XHU0RTNBXHU0RTAwXHU4ODRDICovXG5leHBvcnQgZnVuY3Rpb24gbm9kZVRvTGluZShub2RlOiBTbmFwc2hvdE5vZGUpOiBzdHJpbmcge1xuICBjb25zdCBhdHRycyA9IE9iamVjdC5lbnRyaWVzKG5vZGUuYXR0cmlidXRlcylcbiAgICAubWFwKChbaywgdl0pID0+IGAke2t9PVwiJHt2fVwiYClcbiAgICAuam9pbihcIiBcIik7XG4gIHJldHVybiBgJHtub2RlLnJlZn0gPCR7bm9kZS50YWd9JHthdHRycyA/IFwiIFwiICsgYXR0cnMgOiBcIlwifT4gXCIke25vZGUudGV4dH1cImA7XG59XG5cbi8qKlxuICogXHU1ODlFXHU5MUNGXHU4QkZCXHU1M0Q2XHVGRjFBXHU3RUQ5XHU1QjlBXHU3NkVFXHU2ODA3IHJlZlx1RkYwQ1x1OEZENFx1NTZERVx1OEJFNVx1ODI4Mlx1NzBCOVx1NTNDQVx1NTE3Nlx1NEUwMFx1N0VBN1x1NUI1MFx1NjgxMVx1NzY4NFx1N0QyN1x1NTFEMVx1NjU4N1x1NjcyQ1x1MzAwMlxuICogXHU3NTI4XHU0RThFIEFJIFx1OTcwMFx1ODk4MVx1NjdFNVx1NzcwQlx1NjdEMFx1NTE0M1x1N0QyMFx1NTE4NVx1OTBFOFx1OEJFNlx1NjBDNVx1NjVGNlx1NjI0RFx1NUM1NVx1NUYwMFx1RkYwQ1x1OTA3Rlx1NTE0RFx1NTE2OFx1OTFDRlx1NTJBMFx1OEY3RFx1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhwYW5kTm9kZShzbmFwc2hvdDogUGFnZVNuYXBzaG90LCByZWY6IHN0cmluZywgZGVwdGggPSAxKTogc3RyaW5nIHtcbiAgY29uc3QgZm91bmQgPSBmaW5kTm9kZShzbmFwc2hvdC5yb290LCByZWYpO1xuICBpZiAoIWZvdW5kKSByZXR1cm4gYFx1NjcyQVx1NjI3RVx1NTIzMCByZWY9JHtyZWZ9YDtcbiAgcmV0dXJuIHJlbmRlck5vZGUoZm91bmQsIDAsIGRlcHRoKTtcbn1cblxuZnVuY3Rpb24gZmluZE5vZGUobm9kZTogU25hcHNob3ROb2RlIHwgdW5kZWZpbmVkLCByZWY6IHN0cmluZyk6IFNuYXBzaG90Tm9kZSB8IHVuZGVmaW5lZCB7XG4gIGlmICghbm9kZSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgaWYgKG5vZGUucmVmID09PSByZWYpIHJldHVybiBub2RlO1xuICBmb3IgKGNvbnN0IGMgb2Ygbm9kZS5jaGlsZHJlbiB8fCBbXSkge1xuICAgIGNvbnN0IGhpdCA9IGZpbmROb2RlKGMsIHJlZik7XG4gICAgaWYgKGhpdCkgcmV0dXJuIGhpdDtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiByZW5kZXJOb2RlKG5vZGU6IFNuYXBzaG90Tm9kZSwgZGVwdGg6IG51bWJlciwgbWF4RGVwdGg6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGluZGVudCA9IFwiICBcIi5yZXBlYXQoZGVwdGgpO1xuICBsZXQgb3V0ID0gaW5kZW50ICsgbm9kZVRvTGluZShub2RlKTtcbiAgaWYgKGRlcHRoIDwgbWF4RGVwdGggJiYgbm9kZS5jaGlsZHJlbj8ubGVuZ3RoKSB7XG4gICAgZm9yIChjb25zdCBjIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIG91dCArPSBcIlxcblwiICsgcmVuZGVyTm9kZShjLCBkZXB0aCArIDEsIG1heERlcHRoKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuLyoqXG4gKiBcdTRFQ0VcdTVGRUJcdTcxNjdcdTRFMkRcdTYzRDBcdTUzRDZcdTMwMENcdTVGNTNcdTUyNERcdTg5QzZcdTUzRTNcdTUxODVcdTMwMERcdTc2ODRcdTUxNzNcdTk1MkVcdTUxNDNcdTdEMjBcdUZGMDhcdTc1MjhcdTRFOEVcdTgwNUFcdTcxMjZcdUZGMENcdTUxQ0ZcdTVDMTEgVG9rZW5cdUZGMDlcdTMwMDJcbiAqIFx1NTAxRlx1NTJBOVx1NjgzOVx1ODI4Mlx1NzBCOVx1OTA0RFx1NTM4Nlx1NEZERFx1NzU1OVx1NkJDRlx1NEUyQVx1NEVBNFx1NEU5Mlx1NTE0M1x1N0QyMFx1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5RWxlbWVudHMoc25hcHNob3Q6IFBhZ2VTbmFwc2hvdCwgbGltaXQgPSAzMCk6IEFycmF5PHsgcmVmOiBzdHJpbmc7IHRhZzogc3RyaW5nOyB0ZXh0OiBzdHJpbmcgfT4ge1xuICByZXR1cm4gc25hcHNob3QuaW50ZXJhY3RpdmUuc2xpY2UoMCwgbGltaXQpO1xufVxuIiwgIi8qKlxyXG4gKiBzZWN1cml0eS50cyBcdTIwMTRcdTIwMTQgXHU1Qjg5XHU1MTY4XHU1MkEwXHU1NkZBXHU2QTIxXHU1NzU3XHJcbiAqXHJcbiAqIFx1OTQ4OFx1NUJGOSBCcm93c2VyIEFJIEZvcmdlIFx1NzY4NFx1NkQ0Rlx1ODlDOFx1NTY2OFx1ODFFQVx1NTJBOFx1NTMxNlx1ODBGRFx1NTI5Qlx1NTA1QVx1NUI4OVx1NTE2OFx1NTJBMFx1NTZGQVx1RkYwQ1x1OTFDRFx1NzBCOVx1OTYzMlx1NUZBMVx1RkYxQVxyXG4gKiAxLiAqKlx1NjU0Rlx1NjExRlx1NEZFMVx1NjA2Rlx1NkNDNFx1OTczMlx1RkYwOFx1NEVFNFx1NzI0Qy9cdTVCQzZcdTc4MDFcdUZGMDkqKlx1RkYxQVx1OTg3NVx1OTc2Mlx1NUZFQlx1NzE2N1x1MzAwMVVSTFx1MzAwMVx1NjVFNVx1NUZEN1x1MzAwMVx1NEU4Qlx1NEVGNlx1NkQ0MVx1MzAwMVx1OTUxOVx1OEJFRiBkZXRhaWxcclxuICogICAgXHU0RTJEXHU1M0VGXHU4MEZEXHU2NDNBXHU1RTI2XHU3NTI4XHU2MjM3XHU0RUU0XHU3MjRDXHUzMDAxXHU1QkM2XHU3ODAxXHUzMDAxQVBJIEtleSBcdTdCNDlcdTY1NEZcdTYxMUZcdTRGRTFcdTYwNkZcdUZGMENcdTk3MDBcdTg5ODFcdTdFREZcdTRFMDBcdTgxMzFcdTY1NEZcdUZGMDhyZWRhY3RcdUZGMDlcdTMwMDJcclxuICogMi4gKipIVFRQIFx1NjcwRFx1NTJBMVx1ODhBQlx1NkUxN1x1OTAwRi9cdTYzRDBcdTY3NDMqKlx1RkYxQWAvdG9vbHMvY2FsbGAgXHU1MTQxXHU4QkI4XHU4RkRDXHU3QTBCXHU2M0E3XHU1MjM2XHU3NzFGXHU1QjlFXHU2RDRGXHU4OUM4XHU1NjY4XHVGRjBDXHJcbiAqICAgIFx1NUZDNVx1OTg3Qlx1NTA1QVx1OTI3NFx1Njc0M1x1RkYwOEJlYXJlciBUb2tlblx1RkYwOSsgXHU2NzY1XHU2RTkwXHU5NjUwXHU1MjM2ICsgXHU4QkY3XHU2QzQyXHU0RjUzXHU1OTI3XHU1QzBGXHU5NjUwXHU1MjM2XHVGRjBDXHU5NjMyXHU2QjYyXHU0RUZCXHU2MTBGXHU0RUJBXHU4QzAzXHU3NTI4XHUzMDAyXHJcbiAqIDMuICoqXHU0RUZCXHU2MTBGIEpTIFx1NkNFOFx1NTE2NVx1RkYwOGV2YWxcdUZGMDkqKlx1RkYxQWBldmFsYCBcdTVERTVcdTUxNzdcdTUxNDFcdThCQjhcdTZDRThcdTUxNjVcdTRFRkJcdTYxMEZcdTgxMUFcdTY3MkNcdUZGMENcdTk3MDBcdTUwNUFcdTUzNzFcdTk2NjlcdTY0Q0RcdTRGNUNcdTYyRTZcdTYyMkFcclxuICogICAgXHU0RTBFXHU1Qjg5XHU1MTY4XHU2M0QwXHU3OTNBXHUzMDAyXHJcbiAqIDQuICoqU1NSRiBcdTk4Q0VcdTk2NjkqKlx1RkYxQVx1ODFFQVx1NUI5QVx1NEU0OVx1NjI5NVx1OTAxMlx1RkYwOHdlYmhvb2tcdUZGMDlcdTc2ODQgYGZldGNoKHRhcmdldClgIFx1NzZFRVx1NjgwN1x1NjcyQVx1NjgyMVx1OUE4Q1x1RkYwQ1x1NTNFRlx1ODBGRFxyXG4gKiAgICBcdTg4QUJcdTUyMjlcdTc1MjhcdThCQkZcdTk1RUVcdTUxODVcdTdGNTFcdThENDRcdTZFOTBcdUZGMENcdTk3MDBcdTk2NTBcdTUyMzZcdTc2RUVcdTY4MDdcdTRFM0FcdTY2M0VcdTVGMEZcdTUxNDFcdThCQjhcdTc2ODQgaHR0cChzKSBcdTU3MzBcdTU3NDBcdTVFNzZcdTYyRDJcdTdFRERcdTUxODVcdTdGNTEvSVBcdTMwMDJcclxuICpcclxuICogXHU2MjQwXHU2NzA5XHU1MUZEXHU2NTcwXHU1NzQ3XHU0RTNBXHU3RUFGXHU1MUZEXHU2NTcwL1x1NUU0Mlx1N0I0OVx1RkYwQ1x1NEUwRFx1NjUzOVx1NTNEOFx1NTM5Rlx1NUJGOVx1OEM2MVx1RkYwQ1x1OEZENFx1NTZERVx1ODEzMVx1NjU0Rlx1NTQwRVx1NzY4NFx1NTI2Rlx1NjcyQ1x1RkYwQ1x1NjVCOVx1NEZCRlx1NTcyOFx1NTQwNFx1OTAwMlx1OTE0RFx1NUM0Mlx1NTkwRFx1NzUyOFx1MzAwMlxyXG4gKi9cclxuaW1wb3J0IGNyeXB0byBmcm9tIFwibm9kZTpjcnlwdG9cIjtcclxuXHJcbi8qID09PT09PT09PT09PT09PT09PT09PSBcdTY1NEZcdTYxMUZcdTVCNTdcdTZCQjVcdTVCOUFcdTRFNDkgPT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG4vKiogXHU1RTM4XHU4OUMxXHU3Njg0XHU2NTRGXHU2MTFGXHU1M0MyXHU2NTcwXHU1NDBEXHVGRjA4cXVlcnkgLyBib2R5IC8gaGVhZGVyIC8gXHU1QzVFXHU2MDI3XHVGRjA5XHUyMDE0XHUyMDE0IFx1NTQ3RFx1NEUyRFx1NTM3M1x1ODEzMVx1NjU0RiAqL1xyXG5jb25zdCBTRU5TSVRJVkVfS0VZUyA9IFtcclxuICBcInRva2VuXCIsXHJcbiAgXCJhY2Nlc3NfdG9rZW5cIixcclxuICBcInJlZnJlc2hfdG9rZW5cIixcclxuICBcInNlY3JldFwiLFxyXG4gIFwiY2xpZW50X3NlY3JldFwiLFxyXG4gIFwicGFzc3dvcmRcIixcclxuICBcInBhc3N3ZFwiLFxyXG4gIFwicHdkXCIsXHJcbiAgXCJhcGlrZXlcIixcclxuICBcImFwaV9rZXlcIixcclxuICBcImFwaS1rZXlcIixcclxuICBcImF1dGhcIixcclxuICBcImF1dGhvcml6YXRpb25cIixcclxuICBcImNvb2tpZVwiLFxyXG4gIFwic2V0LWNvb2tpZVwiLFxyXG4gIFwic2Vzc2lvbmlkXCIsXHJcbiAgXCJzaWRcIixcclxuICBcImtleVwiLFxyXG4gIFwicHJpdmF0ZV9rZXlcIixcclxuICBcInByaXZhdGVrZXlcIixcclxuICBcInNpZ25hdHVyZVwiLFxyXG4gIFwiY3JlZGVudGlhbFwiLFxyXG4gIFwiY3JlZGVudGlhbHNcIixcclxuICBcIngtYXBpLWtleVwiLFxyXG4gIFwieC1hdXRoLXRva2VuXCIsXHJcbiAgXCJqd3RcIixcclxuXTtcclxuXHJcbi8qKiBcdTUyMjRcdTY1QURcdTVCNTdcdTZCQjVcdTU0MERcdTY2MkZcdTU0MjZcdTRFM0FcdTY1NEZcdTYxMUZcdTVCNTdcdTZCQjUgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGlzU2Vuc2l0aXZlS2V5KGtleTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgY29uc3QgayA9IGtleS50b0xvd2VyQ2FzZSgpO1xyXG4gIC8vIHNlc3Npb25JZCAvIHNlc3Npb24gXHU0RjFBXHU4QkREXHU2ODA3XHU4QkM2XHU2NzJDXHU4RUFCXHU5NzVFXHU2NTRGXHU2MTFGXHVGRjA4XHU0RUM1XHU3NzFGXHU2QjYzXHU3Njg0XHU0RjFBXHU4QkREXHU0RUU0XHU3MjRDXHU2MjREXHU5NzAwXHU4MTMxXHU2NTRGXHVGRjA5XHJcbiAgaWYgKGsgPT09IFwic2Vzc2lvblwiIHx8IGsgPT09IFwic2Vzc2lvbmlkXCIgfHwgayA9PT0gXCJzaWRcIikgcmV0dXJuIGZhbHNlO1xyXG4gIHJldHVybiBTRU5TSVRJVkVfS0VZUy5zb21lKChzKSA9PiBrLmluY2x1ZGVzKHMpKTtcclxufVxyXG5cclxuLyoqIFx1ODEzMVx1NjU0Rlx1NTM2MFx1NEY0RFx1RkYwOFx1NEZERFx1NzU1OVx1OTU3Rlx1NUVBNlx1NjNEMFx1NzkzQVx1RkYwOSAqL1xyXG5mdW5jdGlvbiBtYXNrKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGlmICghdmFsdWUpIHJldHVybiB2YWx1ZTtcclxuICBpZiAodmFsdWUubGVuZ3RoIDw9IDIpIHJldHVybiBcIioqKipcIjtcclxuICBjb25zdCBoZWFkID0gdmFsdWUuc2xpY2UoMCwgMik7XHJcbiAgY29uc3QgdGFpbCA9IHZhbHVlLmxlbmd0aCA+IDYgPyB2YWx1ZS5zbGljZSgtMikgOiBcIlwiO1xyXG4gIHJldHVybiBgJHtoZWFkfSoqKioke3RhaWx9ICgke3ZhbHVlLmxlbmd0aH0gY2hhcnMpYDtcclxufVxyXG5cclxuLyogPT09PT09PT09PT09PT09PT09PT09IFx1NUJGOVx1OEM2MVx1NkRGMVx1ODEzMVx1NjU0RiA9PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbi8qKlxyXG4gKiBcdTZERjFcdTVFQTZcdTkwNERcdTUzODZcdTRFRkJcdTYxMEZcdTVCRjlcdThDNjEvXHU2NTcwXHU3RUM0L1x1NUI1N1x1N0IyNlx1NEUzMlx1RkYwQ1x1NUJGOVx1MzAwQ1x1NjU0Rlx1NjExRlx1NUI1N1x1NkJCNVx1NTQwRFx1MzAwRFx1NzY4NFx1NTAzQ1x1NTA1QVx1ODEzMVx1NjU0Rlx1MzAwMlxyXG4gKiBcdTc1MjhcdTRFOEVcdTY1RTVcdTVGRDcgcGF5bG9hZFx1MzAwMVx1NEU4Qlx1NEVGNlx1NkQ0MVx1MzAwMVx1OTUxOVx1OEJFRiBkZXRhaWxcdTMwMDFBSU1lc3NhZ2UgXHU3QjQ5XHU3RUQzXHU2Nzg0XHU1MzE2XHU2NTcwXHU2MzZFXHUzMDAyXHJcbiAqIFx1OEZENFx1NTZERVx1ODEzMVx1NjU0Rlx1NTQwRVx1NzY4NFx1NTI2Rlx1NjcyQ1x1RkYwOFx1NEUwRFx1NEZFRVx1NjUzOVx1NTM5Rlx1NUJGOVx1OEM2MVx1RkYwOVx1MzAwMlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlZGFjdERlZXAodmFsdWU6IHVua25vd24sIGRlcHRoID0gMCwgbWF4RGVwdGggPSAxMik6IHVua25vd24ge1xyXG4gIGlmIChkZXB0aCA+IG1heERlcHRoKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdmFsdWU7XHJcblxyXG4gIC8vIFx1NUI1N1x1N0IyNlx1NEUzMlx1NzZGNFx1NjNBNVx1OEZENFx1NTZERVx1RkYwOFx1NUI1N1x1NkJCNVx1NTQwRFx1N0VBN1x1NTIyQlx1NzY4NFx1ODEzMVx1NjU0Rlx1NzUzMVx1NEUwQVx1NUM0MiBpc1NlbnNpdGl2ZUtleSBcdTUxQjNcdTVCOUFcdUZGMDlcclxuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSByZXR1cm4gdmFsdWU7XHJcblxyXG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgcmV0dXJuIHZhbHVlLm1hcCgodikgPT4gcmVkYWN0RGVlcCh2LCBkZXB0aCArIDEsIG1heERlcHRoKSk7XHJcbiAgfVxyXG5cclxuICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICBjb25zdCBvdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XHJcbiAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikpIHtcclxuICAgICAgaWYgKGlzU2Vuc2l0aXZlS2V5KGspKSB7XHJcbiAgICAgICAgb3V0W2tdID0gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBtYXNrKHYpIDogXCIqKipSRURBQ1RFRCoqKlwiO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG91dFtrXSA9IHJlZGFjdERlZXAodiwgZGVwdGggKyAxLCBtYXhEZXB0aCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBvdXQ7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gdmFsdWU7XHJcbn1cclxuXHJcbi8qID09PT09PT09PT09PT09PT09PT09PSBVUkwgXHU4MTMxXHU2NTRGID09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuLyoqXHJcbiAqIFx1NUJGOSBVUkwgXHU1MDVBXHU4MTMxXHU2NTRGXHVGRjFBXHU5NjkwXHU4NUNGIHF1ZXJ5IC8gaGFzaCBcdTRFMkRcdTc2ODRcdTY1NEZcdTYxMUZcdTUzQzJcdTY1NzBcdTUwM0NcdTMwMDJcclxuICogXHU0RjhCXHVGRjFBYGh0dHBzOi8veC5jb20vbG9naW4/dG9rZW49YWJjMTIzJm5leHQ9L2hvbWVgIC0+IGBodHRwczovL3guY29tL2xvZ2luP3Rva2VuPWFiKioqKjIzICg4IGNoYXJzKSZuZXh0PS9ob21lYFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlZGFjdFVybChyYXdVcmw6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgaWYgKCFyYXdVcmwpIHJldHVybiByYXdVcmw7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHUgPSBuZXcgVVJMKHJhd1VybCk7XHJcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBbLi4udS5zZWFyY2hQYXJhbXMua2V5cygpXSkge1xyXG4gICAgICBpZiAoaXNTZW5zaXRpdmVLZXkoa2V5KSkge1xyXG4gICAgICAgIGNvbnN0IHYgPSB1LnNlYXJjaFBhcmFtcy5nZXQoa2V5KSA/PyBcIlwiO1xyXG4gICAgICAgIHUuc2VhcmNoUGFyYW1zLnNldChrZXksIG1hc2sodikpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBoYXNoIFx1NEUyRFx1NTNFRlx1ODBGRFx1NjQzQVx1NUUyNiB0b2tlblx1RkYwOFx1NTk4MiBTUEEgXHU3Njg0ICNhY2Nlc3NfdG9rZW49eHh4XHVGRjA5XHJcbiAgICBpZiAodS5oYXNoICYmIC8odG9rZW58YWNjZXNzX3Rva2VufHNlY3JldHxhdXRoKT0vaS50ZXN0KHUuaGFzaCkpIHtcclxuICAgICAgdS5oYXNoID0gXCIjIyNSRURBQ1RFRCMjI1wiO1xyXG4gICAgfVxyXG4gICAgLy8gXHU3NTI4XHU2MjM3XHU1NDBEXHU1QkM2XHU3ODAxXHU1RjYyXHU1RjBGXHVGRjA4aHR0cDovL3VzZXI6cGFzc0Bob3N0XHVGRjA5XHJcbiAgICBpZiAodS51c2VybmFtZSB8fCB1LnBhc3N3b3JkKSB7XHJcbiAgICAgIHUudXNlcm5hbWUgPSBcIioqKlwiO1xyXG4gICAgICB1LnBhc3N3b3JkID0gXCIqKipcIjtcclxuICAgIH1cclxuICAgIHJldHVybiB1LnRvU3RyaW5nKCk7XHJcbiAgfSBjYXRjaCB7XHJcbiAgICAvLyBcdTk3NUVcdTZDRDUgVVJMXHVGRjFBXHU0RUM1XHU1QkY5XHU2NjBFXHU2NjNFXHU3Njg0IGtleT12YWx1ZSBcdTUwNUFcdTdDOTdcdTc1NjVcdTgxMzFcdTY1NEZcclxuICAgIHJldHVybiByYXdVcmwucmVwbGFjZShcclxuICAgICAgLyhbPyZdKHRva2VufHBhc3N3b3JkfHBhc3N3ZHxzZWNyZXR8YXBpW18tXT9rZXl8YXV0aHxhY2Nlc3NfdG9rZW58cmVmcmVzaF90b2tlbnxjbGllbnRfc2VjcmV0KT0pW14mXSovZ2ksXHJcbiAgICAgIFwiJDEqKipSRURBQ1RFRCoqKlwiXHJcbiAgICApO1xyXG4gIH1cclxufVxyXG5cclxuLyogPT09PT09PT09PT09PT09PT09PT09IEhUVFAgXHU5Mjc0XHU2NzQzID09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBIdHRwQXV0aENvbmZpZyB7XHJcbiAgLyoqIFx1NjYyRlx1NTQyNlx1NTQyRlx1NzUyOFx1OTI3NFx1Njc0M1x1RkYwOFx1OUVEOFx1OEJBNFx1RkYxQVx1NjcyQVx1OTE0RFx1N0Y2RSB0b2tlbiBcdTY1RjZcdTRFNUZcdTYyRDJcdTdFRERcdThGRENcdTdBMEJcdTY3NjVcdTZFOTBcdUZGMDkgKi9cclxuICBlbmFibGVkPzogYm9vbGVhbjtcclxuICAvKiogXHU1MTQxXHU4QkI4XHU3Njg0IEJlYXJlciBUb2tlblx1RkYwOFx1NTkxQVx1NEUyQVx1NEVFNVx1OTAxN1x1NTNGN1x1NTIwNlx1OTY5NFx1RkYxQlx1Njc2NVx1ODFFQVx1NzNBRlx1NTg4M1x1NTNEOFx1OTFDRiBGT1JHRV9IVFRQX1RPS0VOIFx1NjIxNlx1OTE0RFx1N0Y2RVx1RkYwOSAqL1xyXG4gIHRva2Vucz86IHN0cmluZ1tdO1xyXG4gIC8qKiBcdTRFQzVcdTUxNDFcdThCQjhcdTY3NjVcdTgxRUFcdThGRDlcdTRFOUIgSG9zdC9PcmlnaW4gXHU3Njg0XHU4QkY3XHU2QzQyXHVGRjA4XHU2NzY1XHU4MUVBIEZPUkdFX0hUVFBfQUxMT1dFRF9PUklHSU5TXHVGRjBDXHU5MDE3XHU1M0Y3XHU1MjA2XHU5Njk0XHVGRjA5ICovXHJcbiAgYWxsb3dlZE9yaWdpbnM/OiBzdHJpbmdbXTtcclxuICAvKiogXHU0RUM1XHU1MTQxXHU4QkI4XHU1NkRFXHU3M0FGL1x1NjcyQ1x1NjczQVx1NTczMFx1NTc0MFx1OEJCRlx1OTVFRVx1RkYwOFx1OUVEOFx1OEJBNCB0cnVlXHVGRjBDXHU2NzJBXHU5MTREXHU3RjZFIHRva2VuIFx1NjVGNlx1NUYzQVx1NTIzNiB0cnVlXHVGRjA5ICovXHJcbiAgbG9vcGJhY2tPbmx5PzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqIFx1NEVDRVx1NzNBRlx1NTg4M1x1NTNEOFx1OTFDRlx1Njc4NFx1NUVGQSBIVFRQIFx1OTI3NFx1Njc0M1x1OTE0RFx1N0Y2RSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaHR0cEF1dGhDb25maWdGcm9tRW52KCk6IEh0dHBBdXRoQ29uZmlnIHtcclxuICBjb25zdCByYXdUb2tlbnMgPSBwcm9jZXNzLmVudi5GT1JHRV9IVFRQX1RPS0VOID8/IFwiXCI7XHJcbiAgY29uc3QgcmF3T3JpZ2lucyA9IHByb2Nlc3MuZW52LkZPUkdFX0hUVFBfQUxMT1dFRF9PUklHSU5TID8/IFwiXCI7XHJcbiAgY29uc3QgbG9vcGJhY2sgPSAocHJvY2Vzcy5lbnYuRk9SR0VfSFRUUF9MT09QQkFDS19PTkxZID8/IFwidHJ1ZVwiKS50b0xvd2VyQ2FzZSgpICE9PSBcImZhbHNlXCI7XHJcbiAgcmV0dXJuIHtcclxuICAgIGVuYWJsZWQ6ICEhcmF3VG9rZW5zLFxyXG4gICAgdG9rZW5zOiByYXdUb2tlbnMuc3BsaXQoXCIsXCIpLm1hcCgodCkgPT4gdC50cmltKCkpLmZpbHRlcihCb29sZWFuKSxcclxuICAgIGFsbG93ZWRPcmlnaW5zOiByYXdPcmlnaW5zLnNwbGl0KFwiLFwiKS5tYXAoKG8pID0+IG8udHJpbSgpKS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgICBsb29wYmFja09ubHk6IGxvb3BiYWNrLFxyXG4gIH07XHJcbn1cclxuXHJcbi8qKiBcdTUyMjRcdTY1QURcdThCRjdcdTZDNDJcdTY3NjVcdTZFOTBcdTY2MkZcdTU0MjZcdTRFM0FcdTU2REVcdTczQUZcdTU3MzBcdTU3NDBcdUZGMDhcdTU0MkIgSVB2NC9JUHY2IFx1NEUwRSA6OmZmZmY6IFx1NjYyMFx1NUMwNFx1RkYwOSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXNMb29wYmFja1JlbW90ZShhZGRyOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcclxuICBpZiAoIWFkZHIpIHJldHVybiBmYWxzZTtcclxuICBsZXQgYSA9IGFkZHIudG9Mb3dlckNhc2UoKS50cmltKCk7XHJcbiAgLy8gXHU1M0JCXHU2Mzg5XHU3QUVGXHU1M0UzXHVGRjFBSVB2NCBcdTc2ODQgOnBvcnQgLyBJUHY2IFx1NzY4NCBdOnBvcnQgLyBcdTdFQUYgSVB2NiBcdTc2ODQgJXpvbmVcclxuICBpZiAoL15cXFsuKlxcXTovLnRlc3QoYSkpIGEgPSBhLnNsaWNlKDEsIGEuaW5kZXhPZihcIl1cIikpO1xyXG4gIGVsc2UgaWYgKC9eOjpmZmZmOi9pLnRlc3QoYSkpIGEgPSBhLnNsaWNlKDcpOyAvLyBJUHY0IFx1NjYyMFx1NUMwNCA6OmZmZmY6MTI3LjAuMC4xXHJcbiAgZWxzZSBpZiAoYS5pbmNsdWRlcyhcIjpcIikgJiYgIWEuc3RhcnRzV2l0aChcIjo6XCIpKSBhID0gYS5zcGxpdChcIjpcIilbMF07XHJcbiAgYSA9IGEucmVwbGFjZSgvXFwvXFxkKyQvLCBcIlwiKS5yZXBsYWNlKC8lXFx3KyQvLCBcIlwiKTtcclxuICByZXR1cm4gYSA9PT0gXCIxMjcuMC4wLjFcIiB8fCBhID09PSBcIjo6MVwiIHx8IGEgPT09IFwibG9jYWxob3N0XCIgfHwgYSA9PT0gXCIwOjA6MDowOjA6MDowOjFcIjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFx1NjgyMVx1OUE4QyBIVFRQIFx1OEJGN1x1NkM0Mlx1NjYyRlx1NTQyNlx1ODhBQlx1NjM4OFx1Njc0M1x1MzAwMlxyXG4gKiBAcGFyYW0gcmVtb3RlQWRkcmVzcyBcdThCRjdcdTZDNDJcdTY1QjlcdTU3MzBcdTU3NDBcdUZGMDhcdTU5ODIgYDEyNy4wLjAuMTo1NDMyMWAgXHU2MjE2IGByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3NgXHVGRjA5XHJcbiAqIEBwYXJhbSBvcmlnaW4gXHU4QkY3XHU2QzQyXHU3Njg0IE9yaWdpbiAvIFJlZmVyZXIgXHU1OTM0XHVGRjA4XHU1M0VGXHU0RTNBXHU3QTdBXHVGRjA5XHJcbiAqIEBwYXJhbSBhdXRob3JpemF0aW9uIEF1dGhvcml6YXRpb24gXHU1OTM0XHVGRjA4XHU1M0VGXHU0RTNBXHU3QTdBXHVGRjA5XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYXV0aG9yaXplSHR0cFJlcXVlc3QoXHJcbiAgY2ZnOiBIdHRwQXV0aENvbmZpZyxcclxuICByZW1vdGVBZGRyZXNzOiBzdHJpbmcgfCB1bmRlZmluZWQsXHJcbiAgb3JpZ2luOiBzdHJpbmcgfCB1bmRlZmluZWQsXHJcbiAgYXV0aG9yaXphdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkXHJcbik6IHsgb2s6IGJvb2xlYW47IHJlYXNvbj86IHN0cmluZyB9IHtcclxuICAvLyAxKSBcdTU2REVcdTczQUZcdTk2NTBcdTUyMzZcdUZGMUFcdTY3MkFcdTkxNERcdTdGNkUgdG9rZW4gXHU2MjE2XHU2NjNFXHU1RjBGXHU4OTgxXHU2QzQyIGxvb3BiYWNrT25seSBcdTY1RjZcdUZGMENcdTYyRDJcdTdFRERcdTk3NUVcdTY3MkNcdTY3M0FcdTY3NjVcdTZFOTBcdUZGMDhcdTk2MzJcdThGRENcdTdBMEJcdTZFMTdcdTkwMEZcdUZGMDlcclxuICBjb25zdCBsb29wYmFja09ubHkgPSBjZmcubG9vcGJhY2tPbmx5ID8/ICFjZmcuZW5hYmxlZDtcclxuICBpZiAobG9vcGJhY2tPbmx5ICYmICFpc0xvb3BiYWNrUmVtb3RlKHJlbW90ZUFkZHJlc3MpKSB7XHJcbiAgICByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogXCJcdTRFQzVcdTUxNDFcdThCQjhcdTY3MkNcdTY3M0FcdThCQkZcdTk1RUVcdUZGMDhGT1JHRV9IVFRQX0xPT1BCQUNLX09OTFk9dHJ1ZVx1RkYwOVx1MzAwMlwiIH07XHJcbiAgfVxyXG5cclxuICAvLyAyKSBCZWFyZXIgVG9rZW4gXHU5Mjc0XHU2NzQzXHVGRjA4XHU4MkU1XHU2NzA5XHU5MTREXHU3RjZFXHVGRjA5XHJcbiAgaWYgKGNmZy5lbmFibGVkICYmIGNmZy50b2tlbnM/Lmxlbmd0aCkge1xyXG4gICAgY29uc3QgdG9rZW4gPSBhdXRob3JpemF0aW9uPy5yZXBsYWNlKC9eQmVhcmVyXFxzKy9pLCBcIlwiKS50cmltKCkgPz8gXCJcIjtcclxuICAgIGNvbnN0IHRva2VuSGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZSh0b2tlbikuZGlnZXN0KFwiaGV4XCIpO1xyXG4gICAgY29uc3QgdmFsaWQgPSBjZmcudG9rZW5zLnNvbWUoKHQpID0+IHtcclxuICAgICAgY29uc3QgdEhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUodCkuZGlnZXN0KFwiaGV4XCIpO1xyXG4gICAgICAvLyBcdTYwNTJcdTVCOUFcdTY1RjZcdTk1RjRcdTZCRDRcdThGODNcdUZGMENcdTk2MzJcdTY1RjZcdTVFOEZcdTY1M0JcdTUxRkJcclxuICAgICAgY29uc3QgYSA9IEJ1ZmZlci5mcm9tKHRIYXNoKTtcclxuICAgICAgY29uc3QgYiA9IEJ1ZmZlci5mcm9tKHRva2VuSGFzaCk7XHJcbiAgICAgIHJldHVybiBhLmxlbmd0aCA9PT0gYi5sZW5ndGggJiYgY3J5cHRvLnRpbWluZ1NhZmVFcXVhbChhLCBiKTtcclxuICAgIH0pO1xyXG4gICAgaWYgKCF2YWxpZCkgcmV0dXJuIHsgb2s6IGZhbHNlLCByZWFzb246IFwiXHU2NUUwXHU2NTQ4XHU2MjE2XHU3RjNBXHU1OTMxXHU3Njg0IEFQSSBUb2tlblx1MzAwMlwiIH07XHJcbiAgfVxyXG5cclxuICAvLyAzKSBcdTY3NjVcdTZFOTBcdTc2N0RcdTU0MERcdTUzNTVcdUZGMDhcdTgyRTVcdTY3MDlcdTkxNERcdTdGNkVcdUZGMDlcclxuICBpZiAoY2ZnLmFsbG93ZWRPcmlnaW5zPy5sZW5ndGgpIHtcclxuICAgIGlmICghb3JpZ2luKSByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogXCJcdTdGM0FcdTVDMTFcdTY3NjVcdTZFOTAgT3JpZ2luL1JlZmVyZXIgXHU1OTM0XHUzMDAyXCIgfTtcclxuICAgIGNvbnN0IGFsbG93ZWQgPSBjZmcuYWxsb3dlZE9yaWdpbnMuc29tZSgobykgPT4ge1xyXG4gICAgICBpZiAobyA9PT0gXCIqXCIpIHJldHVybiB0cnVlO1xyXG4gICAgICByZXR1cm4gb3JpZ2luID09PSBvIHx8IG9yaWdpbi5zdGFydHNXaXRoKGAke299L2ApIHx8IG9yaWdpbi5zdGFydHNXaXRoKGAke28ucmVwbGFjZSgvXFwvJC8sIFwiXCIpfTpgKTtcclxuICAgIH0pO1xyXG4gICAgaWYgKCFhbGxvd2VkKSByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogXCJcdTY3NjVcdTZFOTBcdTY3MkFcdTg4QUJcdTUxNDFcdThCQjhcdTMwMDJcIiB9O1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHsgb2s6IHRydWUgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFx1NzUxRlx1NjIxMFx1NEUwMFx1NEUyQVx1NUI4OVx1NTE2OFx1NzY4NFx1OTY4Rlx1NjczQSBBUEkgVG9rZW5cdUZGMDhcdTRGOUJcdTk5OTZcdTZCMjFcdTkwRThcdTdGNzJcdTY1RjZcdTUxOTlcdTUxNjVcdTczQUZcdTU4ODNcdTUzRDhcdTkxQ0ZcdUZGMDlcdTMwMDJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUFwaVRva2VuKCk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIGNyeXB0by5yYW5kb21CeXRlcygzMikudG9TdHJpbmcoXCJoZXhcIik7XHJcbn1cclxuXHJcbi8qID09PT09PT09PT09PT09PT09PT09PSBldmFsIC8gXHU1MzcxXHU5NjY5XHU4MTFBXHU2NzJDXHU2MkU2XHU2MjJBID09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuLyoqIFx1OUFEOFx1NTM3MVx1NjRDRFx1NEY1Q1x1NkEyMVx1NUYwRlx1RkYxQVx1NjhDMFx1NkQ0Qlx1NkNFOFx1NTE2NVx1ODExQVx1NjcyQ1x1NEUyRFx1NzY4NFx1NTM3MVx1OTY2OVx1ODg0Q1x1NEUzQVx1RkYwOFx1NjNEMFx1Njc0My9cdTZFMTdcdTkwMEZcdTVDMURcdThCRDVcdUZGMDkgKi9cclxuY29uc3QgREFOR0VST1VTX0pTX1BBVFRFUk5TOiBBcnJheTx7IGxhYmVsOiBzdHJpbmc7IHJlOiBSZWdFeHAgfT4gPSBbXHJcbiAgeyBsYWJlbDogXCJcdTY1ODdcdTRFRjZcdTdDRkJcdTdFREZcdThCQkZcdTk1RUVcIiwgcmU6IC9yZXF1aXJlXFxzKlxcKFxccypbJ1wiXWZzWydcIl18bm9kZTpmc3xyZWFkRmlsZXx3cml0ZUZpbGV8cm1TeW5jfHVubGlua1N5bmMvaSB9LFxyXG4gIHsgbGFiZWw6IFwiXHU1QjUwXHU4RkRCXHU3QTBCXHU2MjY3XHU4ODRDXCIsIHJlOiAvY2hpbGRfcHJvY2Vzc3xleGVjU3luY3xzcGF3blN5bmN8XFxiZXhlY1xccypcXCh8cHJvY2Vzc1xcLmV4ZWMvaSB9LFxyXG4gIHsgbGFiZWw6IFwiXHU3RjUxXHU3RURDXHU2RTE3XHU5MDBGXCIsIHJlOiAvcHJvY2Vzc1xcLmVudnxfX3Byb3RvX198Y29uc3RydWN0b3JcXHMqXFwoXFxzKlsnXCJdY29uc3RydWN0b3IvaSB9LFxyXG4gIHsgbGFiZWw6IFwiXHU2RDRGXHU4OUM4XHU1NjY4XHU2RjBGXHU2RDFFXHU1MjI5XHU3NTI4XCIsIHJlOiAvZXhwbG9pdHxieXBhc3N8YnlwYXNzLipzZWN1cml0eXxkaXNhYmxlLipzZWN1cml0eXxjZXJ0aWZpY2F0ZS9pIH0sXHJcbl07XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV2YWxHdWFyZFJlc3VsdCB7XHJcbiAgYWxsb3dlZDogYm9vbGVhbjtcclxuICByZWFzb25zPzogc3RyaW5nW107XHJcbiAgLyoqIFx1NjYyRlx1NTQyNlx1NTQ3RFx1NEUyRFx1OUFEOFx1NTM3MVx1RkYwOFx1OTcwMFx1NUYzQVx1NTIzNlx1NjJFNlx1NjIyQVx1RkYwOSAqL1xyXG4gIGJsb2NrZWQ6IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBcdTY4MjFcdTlBOENcdTRFMDBcdTZCQjVcdTVDMDZcdTg5ODFcdTZDRThcdTUxNjVcdTYyNjdcdTg4NENcdTc2ODQgSlMgXHU2NjJGXHU1NDI2XHU1Qjg5XHU1MTY4XHUzMDAyXHJcbiAqIFx1NTQ3RFx1NEUyRFx1OUFEOFx1NTM3MVx1NkEyMVx1NUYwRiBcdTIxOTIgXHU1RjNBXHU1MjM2XHU2MkU2XHU2MjJBXHVGRjFCXHU2NzJBXHU1NDdEXHU0RTJEXHU0RjQ2XHU1NDJCXHU2RjVDXHU1NzI4XHU5OENFXHU5NjY5IFx1MjE5MiBcdTUxNDFcdThCQjhcdTRGNDZcdTk2NDRcdTVFMjZcdThCNjZcdTU0NEFcdTMwMDJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBndWFyZEpzU2NyaXB0KHNjcmlwdDogc3RyaW5nKTogRXZhbEd1YXJkUmVzdWx0IHtcclxuICBjb25zdCBibG9ja2VkUmVhc29uczogc3RyaW5nW10gPSBbXTtcclxuICBmb3IgKGNvbnN0IHsgbGFiZWwsIHJlIH0gb2YgREFOR0VST1VTX0pTX1BBVFRFUk5TKSB7XHJcbiAgICBpZiAocmUudGVzdChzY3JpcHQpKSBibG9ja2VkUmVhc29ucy5wdXNoKGxhYmVsKTtcclxuICB9XHJcbiAgcmV0dXJuIHtcclxuICAgIGFsbG93ZWQ6IGJsb2NrZWRSZWFzb25zLmxlbmd0aCA9PT0gMCxcclxuICAgIGJsb2NrZWQ6IGJsb2NrZWRSZWFzb25zLmxlbmd0aCA+IDAsXHJcbiAgICByZWFzb25zOiBibG9ja2VkUmVhc29ucyxcclxuICB9O1xyXG59XHJcblxyXG4vKiA9PT09PT09PT09PT09PT09PT09PT0gXHU2NTg3XHU2NzJDXHU2MkE1XHU1NDRBXHU4MTMxXHU2NTRGID09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuLyoqXHJcbiAqIFx1NUJGOVx1NEVGQlx1NjEwRlx1NjU4N1x1NjcyQ1x1RkYwOFx1OEJDQVx1NjVBRFx1NjJBNVx1NTQ0QVx1MzAwMVx1NjVFNVx1NUZEN1x1MzAwMVx1NUZFQlx1NzE2N1x1NjU4N1x1NjcyQ1x1MzAwMVx1OTUxOVx1OEJFRiBkZXRhaWxcdUZGMDlcdTUwNUFcdTdDOTdcdTdDOTJcdTVFQTZcdTgxMzFcdTY1NEZcdUZGMUFcclxuICogXHU5NjkwXHU4NUNGXHU1RjYyXHU1OTgyIGB0b2tlbj14eHhgXHUzMDAxYHBhc3N3b3JkOiB4eHhgXHUzMDAxYEJlYXJlciB4eHhgXHUzMDAxYEF1dGhvcml6YXRpb246IHh4eGAgXHU3Njg0XHU3MjQ3XHU2QkI1XHUzMDAyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVkYWN0VGV4dChyYXc6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgaWYgKCFyYXcpIHJldHVybiByYXc7XHJcbiAgcmV0dXJuIHJhd1xyXG4gICAgLnJlcGxhY2UoLyhCZWFyZXJcXHMrKVtBLVphLXowLTkuX34rLz0tXSsvZ2ksIFwiJDEqKipSRURBQ1RFRCoqKlwiKVxyXG4gICAgLnJlcGxhY2UoLyhBdXRob3JpemF0aW9uXFxzKls6PV1cXHMqKSg/OkJlYXJlclxccyspP1tBLVphLXowLTkuX34rLz0tXSsvZ2ksIFwiJDEqKipSRURBQ1RFRCoqKlwiKVxyXG4gICAgLnJlcGxhY2UoLyhbPyZdKD86dG9rZW58cGFzc3dvcmR8cGFzc3dkfHNlY3JldHxhcGlbXy1dP2tleXxhY2Nlc3NfdG9rZW58cmVmcmVzaF90b2tlbnxjbGllbnRfc2VjcmV0fGF1dGgpPSlbXiZcXHNcIiddKy9naSwgXCIkMSoqKlJFREFDVEVEKioqXCIpXHJcbiAgICAucmVwbGFjZSgvKHBhc3N3b3JkXFxzKls6PV1cXHMqWydcIl0/KVteJ1wiXFxzLDtdKy9naSwgXCIkMSoqKlJFREFDVEVEKioqXCIpO1xyXG59XHJcblxyXG4vKiogXHU2QzQ3XHU2MDNCXHU1MTY1XHU1M0UzXHVGRjFBXHU1QkY5XHU3RUQzXHU2Nzg0XHU1MzE2XHU1QkY5XHU4QzYxXHU1MDVBXHU2REYxXHU4MTMxXHU2NTRGXHVGRjBDXHU1RTc2XHU4RkQ0XHU1NkRFXHU4MTMxXHU2NTRGXHU1NDBFXHU3Njg0XHU1MjZGXHU2NzJDICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZSh2YWx1ZTogdW5rbm93bik6IHVua25vd24ge1xyXG4gIHJldHVybiByZWRhY3REZWVwKHZhbHVlKTtcclxufVxyXG5cclxuLyogPT09PT09PT09PT09PT09PT09PT09IFNTUkYgXHU5NjMyXHU2MkE0ID09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuLyoqXHJcbiAqIFx1NTIyNFx1NjVBRFx1NEUwMFx1NEUyQSBob3N0bmFtZSBcdTY2MkZcdTU0MjZcdTRFM0FcdTMwMENcdTc5QzFcdTY3MDkvXHU1NkRFXHU3M0FGL1x1OTRGRVx1OERFRlx1NjcyQ1x1NTczMC9cdTRFOTFcdTUxNDNcdTY1NzBcdTYzNkVcdTMwMERcdTU3MzBcdTU3NDBcdUZGMDhcdTU0MkIgSVB2NC9JUHY2XHVGRjA5XHUzMDAyXHJcbiAqIFx1NzUyOFx1NEU4RSB3ZWJob29rIC8gXHU4MUVBXHU1QjlBXHU0RTQ5XHU2Mjk1XHU5MDEyXHU3QjQ5IGBmZXRjaCh0YXJnZXQpYCBcdTUyNERcdTc2ODQgU1NSRiBcdTYyRTZcdTYyMkFcdUZGMENcdTk2MzJcdTZCNjJcdTg4QUJcdTUyMjlcdTc1MjhcdThCQkZcdTk1RUVcdTUxODVcdTdGNTFcdThENDRcdTZFOTBcdTMwMDJcclxuICpcclxuICogXHU4OTg2XHU3NkQ2XHU1NzNBXHU2NjZGXHVGRjA4XHU3NzFGXHU1QjlFXHU2RTE3XHU5MDBGXHU3RUQ1XHU4RkM3XHU3MEI5XHVGRjBDXHU1RkM1XHU5ODdCXHU4OTg2XHU3NkQ2XHVGRjA5XHVGRjFBXHJcbiAqIC0gSVB2NCBcdTU2REVcdTczQUYgMTI3LjAuMC4wLzhcclxuICogLSBJUHY2IFx1NTZERVx1NzNBRiA6OjEgXHU1M0NBXHU1MTc2XHU1RTI2XHU2NUI5XHU2MkVDXHU1M0Y3XHU1MTk5XHU2Q0Q1IFs6OjFdXHJcbiAqIC0gXHU3OUMxXHU2NzA5XHU3RjUxXHU2QkI1IDEwLzhcdTMwMDExNzIuMTYvMTJcdTMwMDExOTIuMTY4LzE2XHJcbiAqIC0gQ0dOQVQgMTAwLjY0LzEwXHJcbiAqIC0gXHU5NEZFXHU4REVGXHU2NzJDXHU1NzMwIC8gXHU0RTkxXHU1MTQzXHU2NTcwXHU2MzZFIDE2OS4yNTQvMTZcdUZGMDhcdTU5ODIgQVdTIDE2OS4yNTQuMTY5LjI1NFx1RkYwQ1x1NTNFRlx1N0E4M1x1NTNENiBJQU0gXHU1MUVEXHU4QkMxXHVGRjA5XHJcbiAqIC0gSVB2NC1tYXBwZWQgSVB2NiA6OmZmZmY6eC54LngueFxyXG4gKiAtIFx1N0VDNFx1NjRBRC9cdTRGRERcdTc1NTlcdTZCQjUgMjI0LzRcdTMwMDEyNDAvNFx1MzAwMTE5OC4xOC8xNVx1MzAwMTE5Mi4wLjAvMjRcclxuICogLSBcdTUxNjhcdTk2RjYgMC4wLjAuMFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGlzUHJpdmF0ZU9yTG9vcGJhY2tIb3N0KGhvc3RuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICBpZiAoIWhvc3RuYW1lKSByZXR1cm4gZmFsc2U7XHJcbiAgLy8gXHU1M0JCXHU2Mzg5IElQdjYgXHU2NUI5XHU2MkVDXHU1M0Y3XHVGRjA4bmV3IFVSTCgpLmhvc3RuYW1lIFx1NUJGOSBbOjoxXSBcdTRGMUFcdTRGRERcdTc1NTlcdTY1QjlcdTYyRUNcdTUzRjdcdUZGMDlcclxuICBsZXQgaCA9IGhvc3RuYW1lLnRyaW0oKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL15cXFt8XFxdJC9nLCBcIlwiKTtcclxuXHJcbiAgLy8gXHU1N0RGXHU1NDBEXHVGRjFBLmxvY2FsIFx1N0VEM1x1NUMzRVx1ODlDNlx1NEUzQVx1NTE4NVx1N0Y1MVx1RkYwOG1ETlNcdUZGMDlcclxuICBpZiAoaC5lbmRzV2l0aChcIi5sb2NhbFwiKSkgcmV0dXJuIHRydWU7XHJcbiAgaWYgKGggPT09IFwibG9jYWxob3N0XCIpIHJldHVybiB0cnVlO1xyXG5cclxuICAvLyBJUHY2IFx1NTZERVx1NzNBRlx1RkYwOFx1NTQyQiBJUHY0LW1hcHBlZCA6OmZmZmY6MTI3LjAuMC4xIFx1NjYyMFx1NUMwNFx1NUY2Mlx1NUYwRlx1RkYwOVxyXG4gIGlmIChoID09PSBcIjo6MVwiIHx8IGggPT09IFwiMDowOjA6MDowOjA6MDoxXCIpIHJldHVybiB0cnVlO1xyXG4gIGlmIChoLnN0YXJ0c1dpdGgoXCI6OmZmZmY6XCIpKSB7XHJcbiAgICAvLyBcdTYyOEEgOjpmZmZmOmEuYi5jLmQgXHU2NjIwXHU1QzA0XHU1NkRFIElQdjQgXHU1NDBFXHU5MDEyXHU1RjUyXHU1MjI0XHU2NUFEXHJcbiAgICBjb25zdCBtYXBwZWRWNCA9IGgucmVwbGFjZSgvXjo6ZmZmZjovLCBcIlwiKS5yZXBsYWNlKC9eMCooWzAtOWEtZl17MSw0fSk6MCooWzAtOWEtZl17MSw0fSkkLywgKF8sIGEsIGIpID0+IHtcclxuICAgICAgY29uc3QgaXAgPSAoaGV4OiBzdHJpbmcpID0+IGAke3BhcnNlSW50KGhleCwgMTYpID4+IDh9LiR7cGFyc2VJbnQoaGV4LCAxNikgJiAweGZmfWA7XHJcbiAgICAgIHJldHVybiBgJHtpcChhKX0uJHtpcChiKX1gO1xyXG4gICAgfSk7XHJcbiAgICBpZiAoL15cXGQrXFwuXFxkK1xcLlxcZCtcXC5cXGQrJC8udGVzdChtYXBwZWRWNCkpIHJldHVybiBpc1ByaXZhdGVPckxvb3BiYWNrSG9zdChtYXBwZWRWNCk7XHJcbiAgICByZXR1cm4gdHJ1ZTsgLy8gXHU1MTc2XHU0RUQ2IDo6ZmZmZjogXHU1RjYyXHU1RjBGXHVGRjA4XHU1OTgyIDo6ZmZmZjo3ZjAwOjFcdUZGMDlcdTRFMDBcdTVGOEJcdTg5QzZcdTRFM0FcdTUxODVcdTdGNTFcdTY2MjBcdTVDMDRcclxuICB9XHJcblxyXG4gIC8vIElQdjYgXHU1MTc2XHU0RUQ2XHU2NzJDXHU1NzMwL1x1OTRGRVx1OERFRlx1NjcyQ1x1NTczMFx1RkYwOGZjMDA6Oi83IFVMQVx1MzAwMWZlODA6Oi8xMCBcdTk0RkVcdThERUZcdTY3MkNcdTU3MzBcdUZGMDlcdTRFMEVcdTUxNjhcdTk2RjZcclxuICBpZiAoaC5pbmNsdWRlcyhcIjpcIikgJiYgIWguaW5jbHVkZXMoXCIuXCIpKSB7XHJcbiAgICBpZiAoaCA9PT0gXCI6OlwiIHx8IGggPT09IFwiMDowOjA6MDowOjA6MDowXCIpIHJldHVybiB0cnVlO1xyXG4gICAgaWYgKC9eZltjZF0vLnRlc3QoaCkgfHwgL15mZVs4OWFiXS8udGVzdChoKSkgcmV0dXJuIHRydWU7IC8vIFVMQSAvIFx1OTRGRVx1OERFRlx1NjcyQ1x1NTczMFxyXG4gICAgLy8gXHU5NzVFXHU1MTY4XHU1QzQwXHU1MzU1XHU2NEFEXHU1MjREXHU3RjAwXHVGRjA4XHU0RTBEXHU0RUU1IDIgXHU2MjE2IDMgXHU1RjAwXHU1OTM0XHVGRjA5XHU0RkREXHU1Qjg4XHU4OUM2XHU0RTNBXHU1MTg1XHU3RjUxL1x1NEZERFx1NzU1OVxyXG4gICAgaWYgKCEvXlsyM11bMC05YS1mXXszfTovLnRlc3QoaCkpIHJldHVybiB0cnVlO1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLy8gSVB2NCBcdTdGNTFcdTZCQjVcdTUyMjRcdTY1QURcclxuICBjb25zdCBtID0gaC5tYXRjaCgvXihcXGR7MSwzfSlcXC4oXFxkezEsM30pXFwuKFxcZHsxLDN9KVxcLihcXGR7MSwzfSkkLyk7XHJcbiAgaWYgKG0pIHtcclxuICAgIGNvbnN0IGEgPSBOdW1iZXIobVsxXSk7XHJcbiAgICBjb25zdCBiID0gTnVtYmVyKG1bMl0pO1xyXG4gICAgY29uc3QgYyA9IE51bWJlcihtWzNdKTtcclxuICAgIGlmIChhID09PSAxMCkgcmV0dXJuIHRydWU7IC8vIDEwLzhcclxuICAgIGlmIChhID09PSAxNzIgJiYgYiA+PSAxNiAmJiBiIDw9IDMxKSByZXR1cm4gdHJ1ZTsgLy8gMTcyLjE2LzEyXHJcbiAgICBpZiAoYSA9PT0gMTkyICYmIGIgPT09IDE2OCkgcmV0dXJuIHRydWU7IC8vIDE5Mi4xNjgvMTZcclxuICAgIGlmIChhID09PSAxMjcpIHJldHVybiB0cnVlOyAvLyAxMjcvOCBcdTU2REVcdTczQUZcclxuICAgIGlmIChhID09PSAxNjkgJiYgYiA9PT0gMjU0KSByZXR1cm4gdHJ1ZTsgLy8gMTY5LjI1NC8xNiBcdTk0RkVcdThERUZcdTY3MkNcdTU3MzAvXHU0RTkxXHU1MTQzXHU2NTcwXHU2MzZFXHJcbiAgICBpZiAoYSA9PT0gMTAwICYmIGIgPj0gNjQgJiYgYiA8PSAxMjcpIHJldHVybiB0cnVlOyAvLyAxMDAuNjQvMTAgQ0dOQVRcclxuICAgIGlmIChhID09PSAwICYmIGIgPT09IDAgJiYgYyA9PT0gMCkgcmV0dXJuIHRydWU7IC8vIDAuMC4wLjBcclxuICAgIGlmIChhID49IDIyNCkgcmV0dXJuIHRydWU7IC8vIFx1N0VDNFx1NjRBRC9cdTRGRERcdTc1NTlcclxuICAgIGlmIChhID09PSAxOTggJiYgKGIgPT09IDE4IHx8IGIgPT09IDE5KSkgcmV0dXJuIHRydWU7IC8vIDE5OC4xOC8xNSBcdTU3RkFcdTUxQzZcdTZENEJcdThCRDVcclxuICAgIGlmIChhID09PSAxOTIgJiYgYiA9PT0gMCkgcmV0dXJuIHRydWU7IC8vIDE5Mi4wLjAvMjRcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8vIFx1OTc1RSBJUCBcdTU3REZcdTU0MERcdTlFRDhcdThCQTRcdTg5QzZcdTRFM0FcdTUxNkNcdTdGNTFcdUZGMDhcdTRFQTRcdTc1MzFcdTRFMEFcdTZFMzggRE5TIFx1ODlFM1x1Njc5MFx1RkYwOVxyXG4gIHJldHVybiBmYWxzZTtcclxufVxyXG4iLCAiLyoqXG4gKiBTZXNzaW9uTG9nZ2VyIFx1MjAxNFx1MjAxNCBcdTRGMUFcdThCRERcdTRFOEJcdTRFRjZcdTY1RTVcdTVGRDdcdTU2NjhcbiAqXG4gKiBcdTdFRjRcdTYyQTRcdTRFMDBcdTY3NjEqKlx1OEZERVx1OEQyRlx1NzY4NFx1NEU4Qlx1NEVGNlx1NkQ0MSoqXHVGRjBDXHU4QkE5XHU1OTE2XHU5MEU4IEFJIC8gSURFIFx1ODBGRFx1RkYxQVxuICogLSBcdThCQTJcdTk2MDVcdTVCOUVcdTY1RjZcdTRFOEJcdTRFRjZcdUZGMDhFdmVudEVtaXR0ZXIgXHU1RjBGXHU2M0E4XHU5MDAxXHVGRjA5XG4gKiAtIFx1NjJDOVx1NTNENlx1NTM4Nlx1NTNGMlx1NEU4Qlx1NEVGNlx1NUZFQlx1NzE2N1x1RkYwOGB0b0FycmF5YCAvIGBleHBvcnRNYXJrZG93bmBcdUZGMDlcbiAqIC0gXHU3NTFGXHU2MjEwXHU0RUJBXHU3QzdCXHU1M0VGXHU4QkZCXHU3Njg0XHU2MjY3XHU4ODRDXHU4RjY4XHU4RkY5XHVGRjA4XHU1NkRFXHU2NTNFXHU1MkE4XHU0RjVDICsgXHU4QkNBXHU2NUFEICsgXHU5NTE5XHU4QkVGICsgXHU2MjJBXHU1NkZFXHVGRjA5XG4gKlxuICogXHU4RkQ5XHU2NjJGXHUzMDBDXHU4RERGIElERSAvIFx1NTkxNlx1OTBFOCBBSSBcdTUzNEZcdTRGNUNcdTMwMERcdTc2ODRcdTZEODhcdTYwNkZcdTYwM0JcdTdFQkZcdUZGMUFcdTY4NDZcdTY3QjZcdTYyNDBcdTY3MDlcdTUyQThcdTRGNUNcdTMwMDFcdThCQ0FcdTY1QURcdTMwMDFcdTk1MTlcdThCRUZcdTMwMDFcbiAqIFx1NjIyQVx1NTZGRVx1MzAwMVx1NjVFNVx1NUZEN1x1OTBGRFx1NkM0N1x1NTE2NVx1OEZEOVx1OTFDQ1x1RkYwQ1x1NTE4RFx1NzUzMVx1OTAwMlx1OTE0RFx1NUM0Mlx1RkYwOHN0ZGlvL0hUVFAvaGFybmVzcy9DTElcdUZGMDlcdThGNkNcdTUzRDFcdTdFRDlcdTU5MTZcdTkwRTggQUlcdTMwMDJcbiAqL1xuaW1wb3J0IHR5cGUge1xuICBFdmVudExldmVsLFxuICBFdmVudENhdGVnb3J5LFxuICBGb3JnZUV2ZW50LFxuICBGb3JnZUVycm9yRXZlbnQsXG4gIFNjcmVlbnNob3RFdmVudCxcbiAgRm9yZ2VBbnlFdmVudCxcbiAgRXZlbnRMaXN0ZW5lcixcbn0gZnJvbSBcIi4vZXZlbnRzLmpzXCI7XG5pbXBvcnQgeyByZWRhY3REZWVwLCByZWRhY3RUZXh0IH0gZnJvbSBcIi4vc2VjdXJpdHkuanNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTZXNzaW9uTG9nZ2VyT3B0aW9ucyB7XG4gIC8qKiBcdTRGMUFcdThCREQgaWRcdUZGMDhcdTdGM0FcdTc3MDFcdTgxRUFcdTUyQThcdTc1MUZcdTYyMTBcdUZGMDkgKi9cbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICAvKiogXHU0RThCXHU0RUY2XHU2RDQxXHU2NzAwXHU1OTI3XHU0RkREXHU3NTU5XHU2NzYxXHU2NTcwXHVGRjA4XHU5NjMyXHU1MTg1XHU1QjU4XHU2NUUwXHU5NjUwXHU1ODlFXHU5NTdGXHVGRjBDXHU3RjNBXHU3NzAxIDIwMDBcdUZGMDkgKi9cbiAgbWF4RXZlbnRzPzogbnVtYmVyO1xuICAvKiogXHU2NjJGXHU1NDI2XHU1NDJGXHU3NTI4XHU2NUU1XHU1RkQ3XHVGRjA4ZGVidWcgXHU3RUE3XHU1MjJCXHU0RUNEXHU4QkIwXHU1RjU1XHVGRjBDXHU1M0VBXHU2NjJGXHU3RUE3XHU1MjJCXHU1QjU3XHU2QkI1XHU0RTNBIGRlYnVnXHVGRjA5ICovXG4gIGVuYWJsZWQ/OiBib29sZWFuO1xufVxuXG4vKiogXHU2NUU1XHU1RkQ3XHU1MTY1XHU1M0UzXHU1M0MyXHU2NTcwXHVGRjA4bWVzc2FnZSArIFx1NTNFRlx1OTAwOSBwYXlsb2FkXHVGRjA5ICovXG5leHBvcnQgaW50ZXJmYWNlIExvZ0VudHJ5IHtcbiAgbGV2ZWw/OiBFdmVudExldmVsO1xuICBjYXRlZ29yeT86IEV2ZW50Q2F0ZWdvcnk7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgcGF5bG9hZD86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG5leHBvcnQgY2xhc3MgU2Vzc2lvbkxvZ2dlciB7XG4gIHJlYWRvbmx5IHNlc3Npb25JZDogc3RyaW5nO1xuICBwcml2YXRlIGV2ZW50czogRm9yZ2VBbnlFdmVudFtdID0gW107XG4gIHByaXZhdGUgbGlzdGVuZXJzID0gbmV3IFNldDxFdmVudExpc3RlbmVyPigpO1xuICBwcml2YXRlIHNlcSA9IDA7XG4gIHByaXZhdGUgbWF4RXZlbnRzOiBudW1iZXI7XG4gIHByaXZhdGUgZW5hYmxlZDogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihvcHRzOiBTZXNzaW9uTG9nZ2VyT3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5zZXNzaW9uSWQgPSBvcHRzLnNlc3Npb25JZCA/PyBgc2Vzc18ke0RhdGUubm93KCkudG9TdHJpbmcoMzYpfSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgOCl9YDtcbiAgICB0aGlzLm1heEV2ZW50cyA9IG9wdHMubWF4RXZlbnRzID8/IDIwMDA7XG4gICAgdGhpcy5lbmFibGVkID0gb3B0cy5lbmFibGVkID8/IHRydWU7XG4gIH1cblxuICAvKiogXHU4QkEyXHU5NjA1XHU1QjlFXHU2NUY2XHU0RThCXHU0RUY2XHVGRjBDXHU4RkQ0XHU1NkRFXHU1M0Q2XHU2RDg4XHU4QkEyXHU5NjA1XHU1MUZEXHU2NTcwICovXG4gIHN1YnNjcmliZShsaXN0ZW5lcjogRXZlbnRMaXN0ZW5lcik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMubGlzdGVuZXJzLmFkZChsaXN0ZW5lcik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMubGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG4gIH1cblxuICAvKiogXHU4QkIwXHU1RjU1XHU0RTAwXHU2NzYxXHU5MDFBXHU3NTI4XHU2NUU1XHU1RkQ3XHU0RThCXHU0RUY2ICovXG4gIGxvZyhlbnRyeTogTG9nRW50cnkpOiBGb3JnZUV2ZW50IHtcbiAgICBjb25zdCBldmVudDogRm9yZ2VFdmVudCA9IHtcbiAgICAgIHNlcTogdGhpcy5uZXh0U2VxKCksXG4gICAgICB0czogRGF0ZS5ub3coKSxcbiAgICAgIGxldmVsOiBlbnRyeS5sZXZlbCA/PyBcImluZm9cIixcbiAgICAgIGNhdGVnb3J5OiBlbnRyeS5jYXRlZ29yeSA/PyBcImxvZ1wiLFxuICAgICAgbWVzc2FnZTogZW50cnkubWVzc2FnZSxcbiAgICAgIHBheWxvYWQ6IGVudHJ5LnBheWxvYWQsXG4gICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuZW1pdChldmVudCk7XG4gIH1cblxuICAvKiogXHU4QkIwXHU1RjU1XHU0RTAwXHU2NzYxXHU2ODA3XHU1MUM2XHU5NTE5XHU4QkVGXHU0RThCXHU0RUY2XHVGRjA4XHU1RTI2XHU2MkE1XHU5NTE5XHU1MzlGXHU1NkUwXHU0RTBFXHU4OUUzXHU5MUNBXHVGRjBDXHU0RUE0XHU3RUQ5XHU1OTE2XHU5MEU4IEFJXHVGRjA5ICovXG4gIGVycm9yKGVycjogT21pdDxGb3JnZUVycm9yRXZlbnRbXCJlcnJvclwiXSwgbmV2ZXI+ICYge1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICBsZXZlbD86IEV2ZW50TGV2ZWw7XG4gICAgcGF5bG9hZD86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICB9KTogRm9yZ2VFcnJvckV2ZW50IHtcbiAgICBjb25zdCB7IG1lc3NhZ2UsIGxldmVsLCBwYXlsb2FkLCAuLi5lcnJvciB9ID0gZXJyO1xuICAgIGNvbnN0IGV2ZW50OiBGb3JnZUVycm9yRXZlbnQgPSB7XG4gICAgICBzZXE6IHRoaXMubmV4dFNlcSgpLFxuICAgICAgdHM6IERhdGUubm93KCksXG4gICAgICBsZXZlbDogbGV2ZWwgPz8gXCJlcnJvclwiLFxuICAgICAgY2F0ZWdvcnk6IFwiZXJyb3JcIixcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBlcnJvcixcbiAgICAgIHBheWxvYWQsXG4gICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuZW1pdChldmVudCk7XG4gIH1cblxuICAvKiogXHU4QkIwXHU1RjU1XHU0RTAwXHU2NzYxXHU2MjJBXHU1NkZFL1x1NTZGRVx1NzI0N1x1NEU4Qlx1NEVGNiAqL1xuICBzY3JlZW5zaG90KGltZzoge1xuICAgIGRhdGFVcmk6IHN0cmluZztcbiAgICBmdWxsUGFnZT86IGJvb2xlYW47XG4gICAgY2FwdGlvbj86IHN0cmluZztcbiAgfSk6IFNjcmVlbnNob3RFdmVudCB7XG4gICAgY29uc3QgYnl0ZUxlbmd0aCA9IGltZy5kYXRhVXJpLnJlcGxhY2UoL15kYXRhOmltYWdlXFwvcG5nO2Jhc2U2NCwvLCBcIlwiKS5sZW5ndGg7XG4gICAgY29uc3QgZXZlbnQ6IFNjcmVlbnNob3RFdmVudCA9IHtcbiAgICAgIHNlcTogdGhpcy5uZXh0U2VxKCksXG4gICAgICB0czogRGF0ZS5ub3coKSxcbiAgICAgIGxldmVsOiBcImluZm9cIixcbiAgICAgIGNhdGVnb3J5OiBcInNjcmVlbnNob3RcIixcbiAgICAgIG1lc3NhZ2U6IGltZy5jYXB0aW9uID8/IGBcdTYyMkFcdTU2RkVcdTVERjJcdTkxQzdcdTk2QzYgKCR7KGJ5dGVMZW5ndGggKiAwLjc1KSAvIDEwMjR9S0IpYCxcbiAgICAgIGltYWdlOiB7XG4gICAgICAgIGRhdGFVcmk6IGltZy5kYXRhVXJpLFxuICAgICAgICBieXRlTGVuZ3RoLFxuICAgICAgICBmdWxsUGFnZTogaW1nLmZ1bGxQYWdlID8/IGZhbHNlLFxuICAgICAgICBjYXB0aW9uOiBpbWcuY2FwdGlvbixcbiAgICAgIH0sXG4gICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuZW1pdChldmVudCk7XG4gIH1cblxuICAvKiogXHU4QkIwXHU1RjU1XHU3Q0ZCXHU3RURGXHU3NTFGXHU1NDdEXHU1NDY4XHU2NzFGXHU0RThCXHU0RUY2ICovXG4gIHN5c3RlbShtZXNzYWdlOiBzdHJpbmcsIHBheWxvYWQ/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IEZvcmdlRXZlbnQge1xuICAgIHJldHVybiB0aGlzLmxvZyh7IGxldmVsOiBcImluZm9cIiwgY2F0ZWdvcnk6IFwic3lzdGVtXCIsIG1lc3NhZ2UsIHBheWxvYWQgfSk7XG4gIH1cblxuICAvKiogXHU4QkIwXHU1RjU1XHU0RTAwXHU2QjIxXHU1MkE4XHU0RjVDXHU2MjY3XHU4ODRDXHU0RThCXHU0RUY2ICovXG4gIGFjdGlvbihtZXNzYWdlOiBzdHJpbmcsIHBheWxvYWQ/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IEZvcmdlRXZlbnQge1xuICAgIHJldHVybiB0aGlzLmxvZyh7IGxldmVsOiBcImluZm9cIiwgY2F0ZWdvcnk6IFwiYWN0aW9uXCIsIG1lc3NhZ2UsIHBheWxvYWQgfSk7XG4gIH1cblxuICAvKiogXHU4QkIwXHU1RjU1XHU0RTAwXHU2QjIxXHU4QkNBXHU2NUFEXHU0RThCXHU0RUY2ICovXG4gIGRpYWdub3NlKG1lc3NhZ2U6IHN0cmluZywgcGF5bG9hZD86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogRm9yZ2VFdmVudCB7XG4gICAgcmV0dXJuIHRoaXMubG9nKHsgbGV2ZWw6IFwiaW5mb1wiLCBjYXRlZ29yeTogXCJkaWFnbm9zZVwiLCBtZXNzYWdlLCBwYXlsb2FkIH0pO1xuICB9XG5cbiAgLyoqIFx1ODNCN1x1NTNENlx1NTE2OFx1OTBFOFx1NTM4Nlx1NTNGMlx1NEU4Qlx1NEVGNlx1RkYwOFx1NUZFQlx1NzE2N1x1RkYwOSAqL1xuICB0b0FycmF5KCk6IEZvcmdlQW55RXZlbnRbXSB7XG4gICAgcmV0dXJuIHRoaXMuZXZlbnRzLnNsaWNlKCk7XG4gIH1cblxuICAvKiogXHU2MzA5XHU3QzdCXHU1MjJCXHU4RkM3XHU2RUU0XHU0RThCXHU0RUY2ICovXG4gIGZpbHRlcihjYXRlZ29yeTogRXZlbnRDYXRlZ29yeSB8IEV2ZW50Q2F0ZWdvcnlbXSk6IEZvcmdlQW55RXZlbnRbXSB7XG4gICAgY29uc3QgY2F0cyA9IEFycmF5LmlzQXJyYXkoY2F0ZWdvcnkpID8gY2F0ZWdvcnkgOiBbY2F0ZWdvcnldO1xuICAgIHJldHVybiB0aGlzLmV2ZW50cy5maWx0ZXIoKGUpID0+IGNhdHMuaW5jbHVkZXMoZS5jYXRlZ29yeSkpO1xuICB9XG5cbiAgLyoqIFx1NkUwNVx1N0E3QVx1NEU4Qlx1NEVGNlx1NkQ0MSAqL1xuICBjbGVhcigpOiB2b2lkIHtcbiAgICB0aGlzLmV2ZW50cyA9IFtdO1xuICAgIHRoaXMuc2VxID0gMDtcbiAgfVxuXG4gIC8qKiBcdTVCRkNcdTUxRkFcdTRFM0EgbWFya2Rvd25cdUZGMDhcdTRGOUJcdTU5MTZcdTkwRTggQUkgLyBQUiBcdThCQzRcdThCQkEgLyBcdTUyMzZcdTU0QzFcdTZEODhcdThEMzlcdUZGMDlcdUZGMENcdTVCRjlcdTZEODhcdTYwNkZcdTRFMEUgcGF5bG9hZCBcdTgxMzFcdTY1NEZcdTk2MzJcdTRFRTRcdTcyNENcdTZDQzRcdTk3MzIgKi9cbiAgZXhwb3J0TWFya2Rvd24ob3B0czogeyB0aXRsZT86IHN0cmluZzsgaW5jbHVkZVNjcmVlbnNob3RzPzogYm9vbGVhbiB9ID0ge30pOiBzdHJpbmcge1xuICAgIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGxpbmVzLnB1c2goYCMgJHtvcHRzLnRpdGxlID8/IFwiRm9yZ2UgXHU0RjFBXHU4QkREXHU0RThCXHU0RUY2XHU2NUU1XHU1RkQ3XCJ9YCk7XG4gICAgbGluZXMucHVzaChgKipTZXNzaW9uKio6ICR7dGhpcy5zZXNzaW9uSWR9IHwgKipcdTRFOEJcdTRFRjZcdTY1NzAqKjogJHt0aGlzLmV2ZW50cy5sZW5ndGh9YCk7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy5ldmVudHMpIHtcbiAgICAgIGNvbnN0IHQgPSBuZXcgRGF0ZShlLnRzKS50b0lTT1N0cmluZygpLnJlcGxhY2UoXCJUXCIsIFwiIFwiKS5zbGljZSgwLCAxOSk7XG4gICAgICBjb25zdCB0YWcgPSBgWyR7ZS5sZXZlbC50b1VwcGVyQ2FzZSgpfS8ke2UuY2F0ZWdvcnl9XWA7XG4gICAgICBjb25zdCBtc2cgPSByZWRhY3RUZXh0KGUubWVzc2FnZSk7XG4gICAgICBpZiAoZS5jYXRlZ29yeSA9PT0gXCJlcnJvclwiKSB7XG4gICAgICAgIGNvbnN0IGVyciA9IChlIGFzIEZvcmdlRXJyb3JFdmVudCkuZXJyb3I7XG4gICAgICAgIGxpbmVzLnB1c2goYC0gXFxgJHt0fVxcYCAqKiR7dGFnfSoqICR7bXNnfWApO1xuICAgICAgICBsaW5lcy5wdXNoKGAgIC0gXHU5NTE5XHU4QkVGXHU3ODAxOiBcXGAke2Vyci5jb2RlfVxcYCB8IFx1NjgzOVx1NTZFMDogJHtlcnIucmVhc29ufWApO1xuICAgICAgICBpZiAoZXJyLmV4cGxhbmF0aW9uKSBsaW5lcy5wdXNoKGAgIC0gXHU1MzlGXHU1NkUwOiAke3JlZGFjdFRleHQoZXJyLmV4cGxhbmF0aW9uKX1gKTtcbiAgICAgICAgaWYgKGVyci5zdWdnZXN0aW9uKSBsaW5lcy5wdXNoKGAgIC0gXHU1RUZBXHU4QkFFOiAke3JlZGFjdFRleHQoZXJyLnN1Z2dlc3Rpb24pfWApO1xuICAgICAgfSBlbHNlIGlmIChlLmNhdGVnb3J5ID09PSBcInNjcmVlbnNob3RcIikge1xuICAgICAgICBjb25zdCBpbWcgPSAoZSBhcyBTY3JlZW5zaG90RXZlbnQpLmltYWdlO1xuICAgICAgICBsaW5lcy5wdXNoKGAtIFxcYCR7dH1cXGAgKioke3RhZ30qKiAke21zZ31gKTtcbiAgICAgICAgaWYgKG9wdHMuaW5jbHVkZVNjcmVlbnNob3RzKSB7XG4gICAgICAgICAgbGluZXMucHVzaChgICAtICFbXHU2MjJBXHU1NkZFXSguL2ZvcmdlLWV2ZW50LSR7ZS5zZXF9LnBuZylgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGluZXMucHVzaChgLSBcXGAke3R9XFxgICoqJHt0YWd9KiogJHttc2d9YCk7XG4gICAgICB9XG4gICAgICBpZiAoZS5wYXlsb2FkICYmIE9iamVjdC5rZXlzKGUucGF5bG9hZCkubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IHAgPSBKU09OLnN0cmluZ2lmeShyZWRhY3REZWVwKGUucGF5bG9hZCkpO1xuICAgICAgICBpZiAocC5sZW5ndGggPD0gNDAwKSBsaW5lcy5wdXNoKGAgIC0gcGF5bG9hZDogXFxgJHtwfVxcYGApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbiAgfVxuXG4gIC8qKiBcdTc1MUZcdTYyMTBcdTdFQUZcdTY1ODdcdTY3MkNcdTYyNjdcdTg4NENcdThGNjhcdThGRjlcdUZGMDhcdTRGOUJcdTY1RTVcdTVGRDcvXHU3RUM4XHU3QUVGXHVGRjA5ICovXG4gIHRvVGltZWxpbmUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5ldmVudHNcbiAgICAgIC5tYXAoKGUpID0+IHtcbiAgICAgICAgY29uc3QgdCA9IG5ldyBEYXRlKGUudHMpLnRvSVNPU3RyaW5nKCkucmVwbGFjZShcIlRcIiwgXCIgXCIpLnNsaWNlKDExLCAxOSk7XG4gICAgICAgIHJldHVybiBgJHt0fSBbJHtlLmxldmVsfV0gJHtlLmNhdGVnb3J5fTogJHtlLm1lc3NhZ2V9YDtcbiAgICAgIH0pXG4gICAgICAuam9pbihcIlxcblwiKTtcbiAgfVxuXG4gIHByaXZhdGUgbmV4dFNlcSgpOiBudW1iZXIge1xuICAgIHJldHVybiArK3RoaXMuc2VxO1xuICB9XG5cbiAgcHJpdmF0ZSBlbWl0PFQgZXh0ZW5kcyBGb3JnZUFueUV2ZW50PihldmVudDogVCk6IFQge1xuICAgIGlmICghdGhpcy5lbmFibGVkKSByZXR1cm4gZXZlbnQ7XG4gICAgdGhpcy5ldmVudHMucHVzaChldmVudCk7XG4gICAgaWYgKHRoaXMuZXZlbnRzLmxlbmd0aCA+IHRoaXMubWF4RXZlbnRzKSB7XG4gICAgICB0aGlzLmV2ZW50cyA9IHRoaXMuZXZlbnRzLnNsaWNlKHRoaXMuZXZlbnRzLmxlbmd0aCAtIHRoaXMubWF4RXZlbnRzKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBsIG9mIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBsKGV2ZW50KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBcdTUzNTVcdTRFMkFcdTc2RDFcdTU0MkNcdTU2NjhcdTVGMDJcdTVFMzhcdTRFMERcdTVGNzFcdTU0Q0RcdTRFOEJcdTRFRjZcdTZENDFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGV2ZW50O1xuICB9XG59XG4iLCAiLyoqXHJcbiAqIEZvcmdlTUNQIFx1MjAxNFx1MjAxNCBNQ1AgXHU2NzBEXHU1MkExXHU1OTA0XHU3NDA2XHU1NjY4XHVGRjA4XHU1MzRGXHU4QkFFXHU2NUUwXHU1MTczXHVGRjA5XHJcbiAqXHJcbiAqIFx1NTE4NVx1OTBFOFx1NUI5RVx1NzNCMFx1NURFNVx1NTE3N1x1NTIwNlx1NTNEMVx1OTAzQlx1OEY5MVx1MzAwMlx1NEUwQVx1NUM0Mlx1NTNFRlx1NzUyOFx1NEUwRFx1NTQwQ1x1NzY4NFx1NEYyMFx1OEY5M1x1NUM0Mlx1RkYwOHN0ZGlvL0hUVFAvU1NFXHVGRjA5XHU1MzA1XHU4OEM1XHVGRjBDXHJcbiAqIFx1NEY3Rlx1NTE3Nlx1NTNFRlx1NjNBNVx1NTE2NSBkZWVwc2VlayBoYXJuZXNzXHUzMDAxY25iLmNvb2xcdTMwMDFDbGF1ZGUgRGVza3RvcCBcdTdCNDlcdTRFRkJcdTYxMEYgTUNQIFx1NUJBMlx1NjIzN1x1N0FFRlx1MzAwMlxyXG4gKi9cclxuaW1wb3J0IHsgRm9yZ2VCcm93c2VyIH0gZnJvbSBcIkBvcGVubGl1bGFuL2NvcmVcIjtcclxuaW1wb3J0IHsgUGxheXdyaWdodEVuZ2luZSB9IGZyb20gXCJAb3BlbmxpdWxhbi9lbmdpbmVzXCI7XHJcbmltcG9ydCB7IERpYWdub3Npc0NlbnRlciB9IGZyb20gXCJAb3BlbmxpdWxhbi9kaWFnbm9zaXNcIjtcclxuaW1wb3J0IHsgY29tcGFjdFNuYXBzaG90IH0gZnJvbSBcIkBvcGVubGl1bGFuL3Rva2VuXCI7XHJcbmltcG9ydCB0eXBlIHsgU3RlYWx0aE9wdGlvbnMgfSBmcm9tIFwiQG9wZW5saXVsYW4vc3RlYWx0aFwiO1xyXG5pbXBvcnQgeyBUT09MUywgb2tSZXN1bHQsIGVyclJlc3VsdCwgdHlwZSBUb29sUmVzdWx0LCB0eXBlIE1jcFRvb2xTY2hlbWEgfSBmcm9tIFwiLi90b29scy5qc1wiO1xyXG5pbXBvcnQgeyBTZXNzaW9uTG9nZ2VyIH0gZnJvbSBcIi4vbG9nZ2VyLmpzXCI7XHJcbmltcG9ydCB7IGJ1aWxkQUlNZXNzYWdlLCBtZXNzYWdlVG9Db250ZW50LCB0eXBlIEFJTWVzc2FnZSB9IGZyb20gXCIuL21lc3NhZ2UuanNcIjtcclxuaW1wb3J0IHR5cGUgeyBGb3JnZUFueUV2ZW50IH0gZnJvbSBcIi4vZXZlbnRzLmpzXCI7XHJcbmltcG9ydCB7IGd1YXJkSnNTY3JpcHQsIHJlZGFjdFVybCwgcmVkYWN0RGVlcCB9IGZyb20gXCIuL3NlY3VyaXR5LmpzXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEZvcmdlTWNwT3B0aW9ucyB7XHJcbiAgLyoqIFx1NjVFMFx1NTkzNFx1NkEyMVx1NUYwRiAqL1xyXG4gIGhlYWRsZXNzPzogYm9vbGVhbjtcclxuICAvKiogQ0RQIFx1OEZERVx1NjNBNVx1NTczMFx1NTc0MCAqL1xyXG4gIGNvbm5lY3RVcmw/OiBzdHJpbmc7XHJcbiAgLyoqIFx1NEYxQVx1OEJERFx1NjVFNVx1NUZEN1x1NTY2OFx1RkYwOFx1N0YzQVx1NzcwMVx1ODFFQVx1NTJBOFx1NTIxQlx1NUVGQVx1RkYwOSAqL1xyXG4gIGxvZ2dlcj86IFNlc3Npb25Mb2dnZXI7XHJcbiAgLyoqIFx1NEU4Qlx1NEVGNlx1NkQ0MVx1NjcwMFx1NTkyN1x1NEZERFx1NzU1OVx1Njc2MVx1NjU3MCAqL1xyXG4gIG1heEV2ZW50cz86IG51bWJlcjtcclxuICAvKiogXHU5NjMyXHU2OEMwXHU2RDRCXHU5MTREXHU3RjZFXHVGRjA4XHU1M0VGXHU5MDA5XHVGRjBDXHU5RUQ4XHU4QkE0XHU1MTczXHU5NUVEXHVGRjA5ICovXHJcbiAgc3RlYWx0aD86IFN0ZWFsdGhPcHRpb25zO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgRm9yZ2VNY3Age1xyXG4gIHJlYWRvbmx5IHRvb2xzOiBNY3BUb29sU2NoZW1hW10gPSBUT09MUztcclxuICAvKiogXHU0RjFBXHU4QkREXHU0RThCXHU0RUY2XHU2NUU1XHU1RkQ3XHU1NjY4IFx1MjAxNFx1MjAxNCBcdTRGOUJcdTU5MTZcdTkwRTggQUkgLyBJREUgXHU4QkEyXHU5NjA1XHU1NDhDXHU2MkM5XHU1M0Q2XHU0RThCXHU0RUY2XHU2RDQxICovXHJcbiAgcmVhZG9ubHkgbG9nZ2VyOiBTZXNzaW9uTG9nZ2VyO1xyXG4gIHByaXZhdGUgYnJvd3Nlcj86IEZvcmdlQnJvd3NlcjtcclxuICBwcml2YXRlIGRpYWdub3Npcz86IERpYWdub3Npc0NlbnRlcjtcclxuXHJcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRzOiBGb3JnZU1jcE9wdGlvbnMgPSB7fSkge1xyXG4gICAgdGhpcy5sb2dnZXIgPSBvcHRzLmxvZ2dlciA/PyBuZXcgU2Vzc2lvbkxvZ2dlcih7IG1heEV2ZW50czogb3B0cy5tYXhFdmVudHMgfSk7XHJcbiAgfVxyXG5cclxuICAvKiogXHU3NTFGXHU1NDdEXHU1NDY4XHU2NzFGXHVGRjFBXHU3ODZFXHU0RkREXHU2RDRGXHU4OUM4XHU1NjY4XHU1REYyXHU1QzMxXHU3RUVBICovXHJcbiAgcHJpdmF0ZSBhc3luYyBlbnN1cmVCcm93c2VyKCk6IFByb21pc2U8Rm9yZ2VCcm93c2VyPiB7XHJcbiAgICBpZiAoIXRoaXMuYnJvd3Nlcikge1xyXG4gICAgICBjb25zdCBlbmdpbmUgPSBuZXcgUGxheXdyaWdodEVuZ2luZSh7XHJcbiAgICAgICAgaGVhZGxlc3M6IHRoaXMub3B0cy5oZWFkbGVzcyA/PyB0cnVlLFxyXG4gICAgICAgIGNvbm5lY3RVcmw6IHRoaXMub3B0cy5jb25uZWN0VXJsLFxyXG4gICAgICAgIHN0ZWFsdGg6IHRoaXMub3B0cy5zdGVhbHRoLFxyXG4gICAgICB9KTtcclxuICAgICAgdGhpcy5icm93c2VyID0gbmV3IEZvcmdlQnJvd3NlcihlbmdpbmUpO1xyXG4gICAgICBhd2FpdCB0aGlzLmJyb3dzZXIuc3RhcnQoKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLmJyb3dzZXI7XHJcbiAgfVxyXG5cclxuICAvKiogXHU2ODM4XHU1RkMzXHVGRjFBXHU1MjA2XHU1M0QxXHU1REU1XHU1MTc3XHU4QzAzXHU3NTI4ICovXHJcbiAgYXN5bmMgY2FsbFRvb2wobmFtZTogc3RyaW5nLCBhcmdzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8VG9vbFJlc3VsdD4ge1xyXG4gICAgY29uc3QgdDAgPSBEYXRlLm5vdygpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gXHU4QkIwXHU1RjU1XHU1REU1XHU1MTc3XHU4QzAzXHU3NTI4XHU1RjAwXHU1OUNCXHVGRjA4c3lzdGVtIFx1NEU4Qlx1NEVGNlx1RkYwQ1x1NEY5Qlx1NTkxNlx1OTBFOCBBSSBcdThGRkRcdThFMkFcdUZGMDlcclxuICAgICAgdGhpcy5sb2dnZXIubG9nKHsgbGV2ZWw6IFwiZGVidWdcIiwgY2F0ZWdvcnk6IFwic3lzdGVtXCIsIG1lc3NhZ2U6IGBcdThDMDNcdTc1MjhcdTVERTVcdTUxNzcgJHtuYW1lfWAsIHBheWxvYWQ6IHsgYXJnczogdGhpcy5zYWZlQXJncyhhcmdzKSB9IH0pO1xyXG5cclxuICAgICAgbGV0IHJlc3VsdDogVG9vbFJlc3VsdDtcclxuICAgICAgc3dpdGNoIChuYW1lKSB7XHJcbiAgICAgICAgY2FzZSBcIm9ic2VydmVcIjoge1xyXG4gICAgICAgICAgY29uc3QgYiA9IGF3YWl0IHRoaXMuZW5zdXJlQnJvd3NlcigpO1xyXG4gICAgICAgICAgY29uc3Qgc25hcCA9IGF3YWl0IGIub2JzZXJ2ZSh7IG1heE5vZGVzOiAoYXJncy5tYXhOb2RlcyBhcyBudW1iZXIpID8/IDIwMCwgbWF4VGV4dExlbmd0aDogKGFyZ3MubWF4VGV4dExlbmd0aCBhcyBudW1iZXIpID8/IDgwIH0pO1xyXG4gICAgICAgICAgcmVzdWx0ID0gb2tSZXN1bHQoY29tcGFjdFNuYXBzaG90KHNuYXApLCB7IHVybDogc25hcC51cmwsIHRpdGxlOiBzbmFwLnRpdGxlLCBzdGF0czogc25hcC5zdGF0cyB9KTtcclxuICAgICAgICAgIHRoaXMubG9nZ2VyLmxvZyh7IGNhdGVnb3J5OiBcImFjdGlvblwiLCBtZXNzYWdlOiBgb2JzZXJ2ZSAke3NuYXAudXJsfSAoJHtzbmFwLnN0YXRzPy5lbWl0dGVkTm9kZXMgPz8gMH0gXHU1M0VGXHU0RUE0XHU0RTkyXHU4MjgyXHU3MEI5KWAgfSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNhc2UgXCJhY3RcIjoge1xyXG4gICAgICAgICAgY29uc3QgYiA9IGF3YWl0IHRoaXMuZW5zdXJlQnJvd3NlcigpO1xyXG4gICAgICAgICAgY29uc3QgYWN0aW9uID0gdGhpcy5ub3JtYWxpemVBY3Rpb24oYXJncyk7XHJcbiAgICAgICAgICBjb25zdCBhY3RSZXN1bHQgPSBhd2FpdCBiLmFjdChhY3Rpb24gYXMgYW55KTtcclxuICAgICAgICAgIGNvbnN0IGxpbmVzID0gW2BcdTUyQThcdTRGNUM6ICR7YWN0UmVzdWx0LnR5cGV9YF07XHJcbiAgICAgICAgICBpZiAoYWN0UmVzdWx0Lm9rKSB7XHJcbiAgICAgICAgICAgIGxpbmVzLnB1c2goYFx1MjcxMyAke2FjdFJlc3VsdC5zdW1tYXJ5fWApO1xyXG4gICAgICAgICAgICBpZiAoYWN0UmVzdWx0LmRpYWdub3N0aWNzPy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICBsaW5lcy5wdXNoKGBcdTI2QTAgXHU1MkE4XHU0RjVDXHU1NDBFXHU2OEMwXHU2RDRCXHU1MjMwICR7YWN0UmVzdWx0LmRpYWdub3N0aWNzLmxlbmd0aH0gXHU2NzYxXHU5ODc1XHU5NzYyXHU1RjAyXHU1RTM4OmApO1xyXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgZCBvZiBhY3RSZXN1bHQuZGlhZ25vc3RpY3Muc2xpY2UoMCwgNSkpIGxpbmVzLnB1c2goYCAgLSBbJHtkLmtpbmR9XSAke2QubWVzc2FnZX1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbGluZXMucHVzaChgXHUyNzE3ICR7YWN0UmVzdWx0LnN1bW1hcnl9YCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBsaW5lcy5wdXNoKGBcdTgwMTdcdTY1RjYgJHthY3RSZXN1bHQuZHVyYXRpb25Nc31tc2ApO1xyXG4gICAgICAgICAgcmVzdWx0ID0gYWN0UmVzdWx0Lm9rID8gb2tSZXN1bHQobGluZXMuam9pbihcIlxcblwiKSwgeyBkYXRhOiBhY3RSZXN1bHQuZGF0YSB9KSA6IGVyclJlc3VsdChsaW5lcy5qb2luKFwiXFxuXCIpKTtcclxuXHJcbiAgICAgICAgICAvLyBcdTUyQThcdTRGNUNcdTRFOEJcdTRFRjZcdUZGMUFcdTYyMTBcdTUyOUYvXHU1OTMxXHU4RDI1XHU5MEZEXHU2Qzg5XHU2REMwXHU0RTNBXHU3RUQzXHU2Nzg0XHU1MzE2XHU0RThCXHU0RUY2XHVGRjA4XHU0RjlCXHU1OTE2XHU5MEU4IEFJIFx1OEZGRFx1OEUyQVx1NjI2N1x1ODg0Q1x1OEY2OFx1OEZGOVx1RkYwOVxyXG4gICAgICAgICAgaWYgKGFjdFJlc3VsdC5vaykge1xyXG4gICAgICAgICAgICB0aGlzLmxvZ2dlci5hY3Rpb24oYFx1NTJBOFx1NEY1QyAke2FjdFJlc3VsdC50eXBlfSBcdTYyMTBcdTUyOUY6ICR7YWN0UmVzdWx0LnN1bW1hcnl9YCwgeyB0eXBlOiBhY3RSZXN1bHQudHlwZSwgZHVyYXRpb25NczogYWN0UmVzdWx0LmR1cmF0aW9uTXMgfSk7XHJcbiAgICAgICAgICAgIGlmIChhY3RSZXN1bHQuZGlhZ25vc3RpY3M/Lmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgIHRoaXMubG9nZ2VyLmRpYWdub3NlKGBcdTUyQThcdTRGNUNcdTU0MEVcdTY4QzBcdTZENEJcdTUyMzAgJHthY3RSZXN1bHQuZGlhZ25vc3RpY3MubGVuZ3RofSBcdTY3NjFcdTk4NzVcdTk3NjJcdTVGMDJcdTVFMzhgLCB7XHJcbiAgICAgICAgICAgICAgICBpdGVtczogYWN0UmVzdWx0LmRpYWdub3N0aWNzLnNsaWNlKDAsIDUpLm1hcCgoZCkgPT4gKHsga2luZDogZC5raW5kLCBtZXNzYWdlOiBkLm1lc3NhZ2UgfSkpLFxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBcdTY4MDdcdTUxQzZcdTk1MTlcdThCRUZcdTRFOEJcdTRFRjZcdUZGMUFcdTVFMjZcdTYyQTVcdTk1MTlcdTUzOUZcdTU2RTBcdTRFMEVcdTg5RTNcdTkxQ0FcdUZGMENcdTRFQTRcdTdFRDlcdTU5MTZcdTkwRTggQUlcclxuICAgICAgICAgICAgdGhpcy5sb2dnZXIuZXJyb3Ioe1xyXG4gICAgICAgICAgICAgIG1lc3NhZ2U6IGBcdTUyQThcdTRGNUMgJHthY3RSZXN1bHQudHlwZX0gXHU1OTMxXHU4RDI1OiAke2FjdFJlc3VsdC5zdW1tYXJ5fWAsXHJcbiAgICAgICAgICAgICAgY29kZTogdGhpcy5tYXBFcnJvckNvZGUoYWN0UmVzdWx0LnR5cGUpLFxyXG4gICAgICAgICAgICAgIHJlYXNvbjogdGhpcy5tYXBFcnJvclJlYXNvbihhY3RSZXN1bHQuc3VtbWFyeSwgYWN0UmVzdWx0LmRpYWdub3N0aWNzKSxcclxuICAgICAgICAgICAgICByYXc6IGFjdFJlc3VsdC5zdW1tYXJ5LFxyXG4gICAgICAgICAgICAgIGV4cGxhbmF0aW9uOiB0aGlzLmJ1aWxkRXhwbGFuYXRpb24oYWN0UmVzdWx0LnN1bW1hcnksIGFjdFJlc3VsdC5kaWFnbm9zdGljcyksXHJcbiAgICAgICAgICAgICAgc3VnZ2VzdGlvbjogdGhpcy5idWlsZFN1Z2dlc3Rpb24oYWN0UmVzdWx0LnN1bW1hcnkpLFxyXG4gICAgICAgICAgICAgIGRldGFpbDogYWN0UmVzdWx0LmVycm9yLFxyXG4gICAgICAgICAgICAgIGZpbmRpbmdzOiAoYWN0UmVzdWx0LmRpYWdub3N0aWNzID8/IFtdKS5zbGljZSgwLCA1KS5tYXAoKGQpID0+ICh7XHJcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogZC5raW5kLFxyXG4gICAgICAgICAgICAgICAgc2V2ZXJpdHk6IGQuc2V2ZXJpdHksXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBkLm1lc3NhZ2UsXHJcbiAgICAgICAgICAgICAgfSkpLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2FzZSBcImRpYWdub3NlXCI6IHtcclxuICAgICAgICAgIGNvbnN0IGIgPSBhd2FpdCB0aGlzLmVuc3VyZUJyb3dzZXIoKTtcclxuICAgICAgICAgIGNvbnN0IHJlcG9ydCA9IGF3YWl0IGIuY2FwdHVyZURpYWdub3N0aWNzKCk7XHJcbiAgICAgICAgICAvLyBcdTc1MjggZGlhZ25vc2lzIFx1NEUyRFx1NUZDM1x1NzUxRlx1NjIxMFx1NjQ1OFx1ODk4MVx1RkYwOGNvcmUgXHU0RTBFIGRpYWdub3NpcyBcdTc2ODRcdTYyQTVcdTU0NEFcdTdDN0JcdTU3OEJcdTVERjJcdTVCRjlcdTlGNTBcdUZGMENcdTY1RTBcdTk3MDBcdTVGM0FcdThGNkNcdUZGMDlcclxuICAgICAgICAgIGNvbnN0IHsgc3VtbWFyaXplIH0gPSBhd2FpdCBpbXBvcnQoXCJAb3BlbmxpdWxhbi9kaWFnbm9zaXNcIik7XHJcbiAgICAgICAgICBjb25zdCBzdW1tYXJ5ID0gc3VtbWFyaXplKHJlcG9ydCk7XHJcbiAgICAgICAgICBjb25zdCBsaW5lcyA9IFtgIyBcdThCQ0FcdTY1QURcdTdFRDNcdTY3OUMgKCR7c3VtbWFyeS5oZWFsdGh5ID8gXCJcdTUwNjVcdTVFQjdcIiA6IFwiXHU1QjU4XHU1NzI4XHU5NUVFXHU5ODk4XCJ9KWBdO1xyXG4gICAgICAgICAgaWYgKHN1bW1hcnkuaXNzdWVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBsaW5lcy5wdXNoKFwiXHU2NzJBXHU1M0QxXHU3M0IwXHU5NTE5XHU4QkVGXHVGRjBDXHU5ODc1XHU5NzYyXHU4RkQwXHU4ODRDXHU2QjYzXHU1RTM4XHUzMDAyXCIpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZm9yIChjb25zdCBpc3N1ZSBvZiBzdW1tYXJ5Lmlzc3Vlcykge1xyXG4gICAgICAgICAgICBsaW5lcy5wdXNoKGAtIFske2lzc3VlLmNhdGVnb3J5fS8ke2lzc3VlLnNldmVyaXR5fV0gJHtpc3N1ZS5tZXNzYWdlfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKHN1bW1hcnkuc3VnZ2VzdGlvbnMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGxpbmVzLnB1c2goYFxcbiMjIFx1NUVGQVx1OEJBRWApO1xyXG4gICAgICAgICAgICBzdW1tYXJ5LnN1Z2dlc3Rpb25zLmZvckVhY2goKHMsIGkpID0+IGxpbmVzLnB1c2goYCR7aSArIDF9LiAke3N9YCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmVzdWx0ID0gb2tSZXN1bHQobGluZXMuam9pbihcIlxcblwiKSwge1xyXG4gICAgICAgICAgICBpc3N1ZXM6IHN1bW1hcnkuaXNzdWVzLFxyXG4gICAgICAgICAgICBjb25zb2xlOiByZXBvcnQuY29uc29sZS5sZW5ndGgsXHJcbiAgICAgICAgICAgIG5ldHdvcms6IHJlcG9ydC5uZXR3b3JrLmxlbmd0aCxcclxuICAgICAgICAgICAgZG9tOiByZXBvcnQuZG9tLmxlbmd0aCxcclxuICAgICAgICAgICAganNFeGNlcHRpb25zOiByZXBvcnQuanNFeGNlcHRpb25zLmxlbmd0aCxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgdGhpcy5sb2dnZXIuZGlhZ25vc2UoYFx1OEJDQVx1NjVBRFx1NUI4Q1x1NjIxMDogJHtzdW1tYXJ5LmhlYWx0aHkgPyBcIlx1NTA2NVx1NUVCN1wiIDogYCR7c3VtbWFyeS5pc3N1ZXMubGVuZ3RofSBcdTY3NjFcdTk1RUVcdTk4OThgfWAsIHtcclxuICAgICAgICAgICAgaGVhbHRoeTogc3VtbWFyeS5oZWFsdGh5LFxyXG4gICAgICAgICAgICBpc3N1ZXM6IHN1bW1hcnkuaXNzdWVzLmxlbmd0aCxcclxuICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IHN1bW1hcnkuc3VnZ2VzdGlvbnMubGVuZ3RoLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNhc2UgXCJldmFsXCI6IHtcclxuICAgICAgICAgIGNvbnN0IGIgPSBhd2FpdCB0aGlzLmVuc3VyZUJyb3dzZXIoKTtcclxuICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IFN0cmluZyhhcmdzLnNjcmlwdCk7XHJcbiAgICAgICAgICAvLyBcdTVCODlcdTUxNjhcdTUyQTBcdTU2RkFcdUZGMUFcdTYyRTZcdTYyMkFcdTlBRDhcdTUzNzFcdTZDRThcdTUxNjVcdTgxMUFcdTY3MkNcdUZGMDhcdTY1ODdcdTRFRjZcdTdDRkJcdTdFREYvXHU1QjUwXHU4RkRCXHU3QTBCL1x1NkUxN1x1OTAwRlx1NUMxRFx1OEJENVx1RkYwOVx1RkYwQ1x1OTYzMlx1NjNEMFx1Njc0M1xyXG4gICAgICAgICAgY29uc3QgZ3VhcmQgPSBndWFyZEpzU2NyaXB0KHNjcmlwdCk7XHJcbiAgICAgICAgICBpZiAoZ3VhcmQuYmxvY2tlZCkge1xyXG4gICAgICAgICAgICByZXN1bHQgPSBlcnJSZXN1bHQoXHJcbiAgICAgICAgICAgICAgYGV2YWwgXHU4OEFCXHU1Qjg5XHU1MTY4XHU2MkU2XHU2MjJBXHVGRjFBXHU4MTFBXHU2NzJDXHU1NDdEXHU0RTJEXHU5QUQ4XHU1MzcxXHU2NENEXHU0RjVDIFskeyhndWFyZC5yZWFzb25zID8/IFtdKS5qb2luKFwiLCBcIil9XVx1MzAwMmAgK1xyXG4gICAgICAgICAgICAgICAgYFxcblx1NEUzQVx1OTYzMlx1NjNEMFx1Njc0My9cdTZFMTdcdTkwMEZcdUZGMENcdTc5ODFcdTZCNjJcdTkwMUFcdThGQzcgZXZhbCBcdTZDRThcdTUxNjVcdTY1ODdcdTRFRjZcdTdDRkJcdTdFREZcdThCQkZcdTk1RUVcdTMwMDFcdTVCNTBcdThGREJcdTdBMEJcdTYyNjdcdTg4NENcdTYyMTZcdTdDRkJcdTdFREZcdTdFQTdcdTY0Q0RcdTRGNUNcdTMwMDJgXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKHtcclxuICAgICAgICAgICAgICBtZXNzYWdlOiBgZXZhbCBcdTg4QUJcdTVCODlcdTUxNjhcdTYyRTZcdTYyMkE6ICR7Z3VhcmQucmVhc29ucz8uam9pbihcIiwgXCIpfWAsXHJcbiAgICAgICAgICAgICAgY29kZTogXCJFVkFMX0JMT0NLRURcIixcclxuICAgICAgICAgICAgICByZWFzb246IFwiZGFuZ2Vyb3VzLXNjcmlwdFwiLFxyXG4gICAgICAgICAgICAgIHJhdzogc2NyaXB0LnNsaWNlKDAsIDMwMCksXHJcbiAgICAgICAgICAgICAgZXhwbGFuYXRpb246IFwiXHU2OEMwXHU2RDRCXHU1MjMwXHU5QUQ4XHU1MzcxXHU2Q0U4XHU1MTY1XHU4MTFBXHU2NzJDXHVGRjBDXHU0RTNBXHU5NjMyXHU2M0QwXHU2NzQzL1x1NkUxN1x1OTAwRlx1NURGMlx1NjJEMlx1N0VERFx1NjI2N1x1ODg0Q1x1MzAwMlwiLFxyXG4gICAgICAgICAgICAgIHN1Z2dlc3Rpb246IFwiXHU3OUZCXHU5NjY0XHU2NTg3XHU0RUY2XHU3Q0ZCXHU3RURGL1x1NUI1MFx1OEZEQlx1N0EwQi9cdTdDRkJcdTdFREZcdTdFQTdcdThCQkZcdTk1RUVcdTRFRTNcdTc4MDFcdUZGMENcdTRFQzVcdTRGRERcdTc1NTlcdTk4NzVcdTk3NjJcdTUxODVcdTc2ODQgRE9NL0pTIFx1OEJDQVx1NjVBRFx1MzAwMlwiLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBjb25zdCBldmFsUmVzdWx0ID0gYXdhaXQgYi5ldmFsKHNjcmlwdCk7XHJcbiAgICAgICAgICAvLyBcdTVCRjlcdTdFRDNcdTY3OUNcdTUwNUFcdTgxMzFcdTY1NEZcdUZGMENcdTkwN0ZcdTUxNEQgZXZhbCBcdThGRDRcdTU2REVcdTc2ODRcdTY1NEZcdTYxMUZcdTUwM0NcdUZGMDhcdTU5ODIgdG9rZW4vcGFzc3dvcmRcdUZGMDlcdTU5MTZcdTZDQzRcclxuICAgICAgICAgIGNvbnN0IHNhbml0aXplZFJlc3VsdCA9IHJlZGFjdERlZXAoZXZhbFJlc3VsdCk7XHJcbiAgICAgICAgICByZXN1bHQgPSBva1Jlc3VsdChgXHU2MjY3XHU4ODRDXHU3RUQzXHU2NzlDOiAke0pTT04uc3RyaW5naWZ5KHNhbml0aXplZFJlc3VsdCk/LnNsaWNlKDAsIDIwMDApfWAsIHsgcmVzdWx0OiBzYW5pdGl6ZWRSZXN1bHQgfSk7XHJcbiAgICAgICAgICB0aGlzLmxvZ2dlci5sb2coeyBjYXRlZ29yeTogXCJhY3Rpb25cIiwgbWVzc2FnZTogXCJldmFsIFx1NjI2N1x1ODg0Q1wiIH0pO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjYXNlIFwic2NyZWVuc2hvdFwiOiB7XHJcbiAgICAgICAgICBjb25zdCBiID0gYXdhaXQgdGhpcy5lbnN1cmVCcm93c2VyKCk7XHJcbiAgICAgICAgICBjb25zdCBzaG90ID0gYXdhaXQgYi5hY3QoeyB0eXBlOiBcInNjcmVlbnNob3RcIiwgZnVsbFBhZ2U6ICEhYXJncy5mdWxsUGFnZSB9IGFzIGFueSk7XHJcbiAgICAgICAgICBjb25zdCBiYXNlNjQgPSAoc2hvdC5kYXRhIGFzIGFueSk/LmJhc2U2NDtcclxuICAgICAgICAgIGNvbnN0IGRhdGFVcmkgPSBgZGF0YTppbWFnZS9wbmc7YmFzZTY0LCR7YmFzZTY0fWA7XHJcbiAgICAgICAgICByZXN1bHQgPSBva1Jlc3VsdChzaG90LnN1bW1hcnksIHsgaW1hZ2U6IGRhdGFVcmkgfSk7XHJcbiAgICAgICAgICAvLyBcdTYyMkFcdTU2RkVcdTRFOEJcdTRFRjZcdUZGMUFcdTYyOEFcdTU2RkVcdTcyNDdcdTdFQjNcdTUxNjVcdTRFOEJcdTRFRjZcdTZENDFcdUZGMENcdTRGOUJcdTU5MTZcdTkwRThcdTU5MUFcdTZBMjFcdTYwMDEgQUkgXHU2RDg4XHU4RDM5XHJcbiAgICAgICAgICB0aGlzLmxvZ2dlci5zY3JlZW5zaG90KHtcclxuICAgICAgICAgICAgZGF0YVVyaSxcclxuICAgICAgICAgICAgZnVsbFBhZ2U6ICEhYXJncy5mdWxsUGFnZSxcclxuICAgICAgICAgICAgY2FwdGlvbjogYXJncy5jYXB0aW9uID8gU3RyaW5nKGFyZ3MuY2FwdGlvbikgOiBzaG90LnN1bW1hcnksXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2FzZSBcInNlc3Npb25fbG9nXCI6IHtcclxuICAgICAgICAgIC8vIFx1OEJBOVx1NTkxNlx1OTBFOCBBSSBcdTYyQzlcdTUzRDZcdTRGMUFcdThCRERcdTRFOEJcdTRFRjZcdTZENDFcdUZGMDhcdThGRDlcdTY2MkYgQUkgXHU1MzRGXHU0RjVDXHU3Njg0XCJcdThGRkRcdThFMkFcdTgwRkRcdTUyOUJcIlx1RkYwOVxyXG4gICAgICAgICAgY29uc3QgZXZlbnRzID0gdGhpcy5sb2dnZXIudG9BcnJheSgpO1xyXG4gICAgICAgICAgY29uc3QgZm9ybWF0ID0gU3RyaW5nKGFyZ3MuZm9ybWF0ID8/IFwibWFya2Rvd25cIik7XHJcbiAgICAgICAgICBpZiAoZm9ybWF0ID09PSBcImpzb25cIikge1xyXG4gICAgICAgICAgICAvLyBcdTVCRjlcdTRFOEJcdTRFRjZcdTZENDFcdTUwNUFcdTZERjFcdTgxMzFcdTY1NEZcdUZGMENcdTk2MzJcdTZCNjIgcGF5bG9hZCBcdTY0M0FcdTVFMjZcdTc2ODRcdTRFRTRcdTcyNEMvXHU1QkM2XHU3ODAxXHU1OTE2XHU2Q0M0XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IG9rUmVzdWx0KGBcdTUxNzEgJHtldmVudHMubGVuZ3RofSBcdTY3NjFcdTRFOEJcdTRFRjZgLCB7IGV2ZW50czogcmVkYWN0RGVlcChldmVudHMpIH0pO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgbWQgPSB0aGlzLmxvZ2dlci5leHBvcnRNYXJrZG93bih7IHRpdGxlOiBhcmdzLnRpdGxlID8gU3RyaW5nKGFyZ3MudGl0bGUpIDogdW5kZWZpbmVkIH0pO1xyXG4gICAgICAgICAgICByZXN1bHQgPSBva1Jlc3VsdChtZCwgeyBldmVudENvdW50OiBldmVudHMubGVuZ3RoIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjYXNlIFwiY2xvc2VcIjoge1xyXG4gICAgICAgICAgaWYgKHRoaXMuYnJvd3Nlcikge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmJyb3dzZXIuc3RvcCgpO1xyXG4gICAgICAgICAgICB0aGlzLmJyb3dzZXIgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXN1bHQgPSBva1Jlc3VsdChcIlx1NkQ0Rlx1ODlDOFx1NTY2OFx1NURGMlx1NTE3M1x1OTVFRFwiKTtcclxuICAgICAgICAgIHRoaXMubG9nZ2VyLnN5c3RlbShcIlx1NkQ0Rlx1ODlDOFx1NTY2OFx1NURGMlx1NTE3M1x1OTVFRFwiKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2FzZSBcInN0ZWFsdGhfc3RhdHVzXCI6IHtcclxuICAgICAgICAgIC8vIFx1NjdFNVx1OEJFMlx1OTYzMlx1NjhDMFx1NkQ0Qlx1NkEyMVx1NTc1N1x1NzJCNlx1NjAwMVx1RkYwOFx1OTcwMFx1NTcyOFx1Njc4NFx1OTAyMFx1NjVGNlx1OTE0RFx1N0Y2RSBzdGVhbHRoIFx1NjI0RFx1ODBGRFx1NzUxRlx1NjU0OFx1RkYwOVxyXG4gICAgICAgICAgY29uc3Qgc3RlYWx0aE9wdHMgPSB0aGlzLm9wdHMuc3RlYWx0aDtcclxuICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSBzdGVhbHRoT3B0cz8uZW5hYmxlZCA/PyBmYWxzZTtcclxuICAgICAgICAgIGNvbnN0IGxldmVsID0gc3RlYWx0aE9wdHM/LmxldmVsID8/IFwiYmFzaWNcIjtcclxuICAgICAgICAgIGNvbnN0IHVhID0gc3RlYWx0aE9wdHM/LnVzZXJBZ2VudCA/PyBcImRlZmF1bHRcIjtcclxuICAgICAgICAgIGNvbnN0IGxpbmVzID0gW1xyXG4gICAgICAgICAgICBgIyBcdTk2MzJcdTY4QzBcdTZENEJcdUZGMDhTdGVhbHRoXHVGRjA5XHU3MkI2XHU2MDAxYCxcclxuICAgICAgICAgICAgYC0gKipcdTU0MkZcdTc1MjgqKjogJHtlbmFibGVkID8gXCJcdTI3MDUgXHU2NjJGXCIgOiBcIlx1Mjc0QyBcdTU0MjZcIn1gLFxyXG4gICAgICAgICAgICBgLSAqKlx1N0VBN1x1NTIyQioqOiAke2xldmVsfWAsXHJcbiAgICAgICAgICAgIGAtICoqVXNlci1BZ2VudCoqOiAke3VhfWAsXHJcbiAgICAgICAgICAgIGBgLFxyXG4gICAgICAgICAgICBlbmFibGVkXHJcbiAgICAgICAgICAgICAgPyBcIj4gU3RlYWx0aCBcdTVERjJcdTU0MkZcdTc1MjhcdUZGMUFcdTUzQ0RcdTYzMDdcdTdFQjlcdTZDRThcdTUxNjVcdTMwMDFcdTgxRUFcdTUyQThcdTUzMTZcdTYzQTdcdTUyMzZcdTk2OTBcdTg1Q0ZcdTMwMDFcdTRFQkFcdTdDN0JcdTg4NENcdTRFM0FcdTZBMjFcdTYyREZcdTU3NDdcdTc1MUZcdTY1NDhcdTMwMDJcIlxyXG4gICAgICAgICAgICAgIDogXCI+IFN0ZWFsdGggXHU2NzJBXHU1NDJGXHU3NTI4XHUzMDAyXHU4MkU1XHU5MUM3XHU5NkM2XHU1MTZDXHU1RjAwXHU2NTcwXHU2MzZFXHU2NUY2XHU4OEFCXHU5NjUwXHU5MDFGL1x1NUMwMVx1Nzk4MVx1RkYwQ1x1NTNFRlx1OTAxQVx1OEZDNyBgc3RlYWx0aC5lbmFibGVkPXRydWVgIFx1NTcyOFx1NTIxRFx1NTlDQlx1NTMxNlx1NjVGNlx1NUYwMFx1NTQyRlx1MzAwMlwiLFxyXG4gICAgICAgICAgXTtcclxuICAgICAgICAgIHJlc3VsdCA9IG9rUmVzdWx0KGxpbmVzLmpvaW4oXCJcXG5cIiksIHsgZW5hYmxlZCwgbGV2ZWwsIHVhIH0pO1xyXG4gICAgICAgICAgdGhpcy5sb2dnZXIubG9nKHsgY2F0ZWdvcnk6IFwic3lzdGVtXCIsIG1lc3NhZ2U6IGBcdTY3RTVcdThCRTIgc3RlYWx0aCBcdTcyQjZcdTYwMDE6ICR7ZW5hYmxlZCA/IFwiZW5hYmxlZFwiIDogXCJkaXNhYmxlZFwifWAgfSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICByZXN1bHQgPSBlcnJSZXN1bHQoYFx1NjcyQVx1NzdFNVx1NURFNVx1NTE3NzogJHtuYW1lfVx1MzAwMlx1NTNFRlx1NzUyOFx1NURFNVx1NTE3NzogJHtUT09MUy5tYXAoKHQpID0+IHQubmFtZSkuam9pbihcIiwgXCIpfWApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBcdTYyOEFcdTY3MkNcdTZCMjFcdThDMDNcdTc1MjhcdTc2ODRcdTY3MDBcdTY1QjBcdTRFOEJcdTRFRjZcdTZDRThcdTUxNjVcdThGRDRcdTU2REVcdTdFRDNcdTY3OUNcdUZGMENcdThCQTlcdTU5MTZcdTkwRTggQUkgXHU2MkZGXHU1MjMwXCJcdTUzRDFcdTc1MUZcdTRFODZcdTRFQzBcdTRFNDggKyBcdTRFM0FcdTRFQzBcdTRFNDggKyBcdTU2RkUgKyBcdTY1RTVcdTVGRDdcIlxyXG4gICAgICByZXN1bHQgPSB0aGlzLmF0dGFjaEV2ZW50cyhyZXN1bHQsIG5hbWUpO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcclxuICAgICAgLy8gXHU1RjAyXHU1RTM4XHU0RTVGXHU2Qzg5XHU2REMwXHU0RTNBXHU2ODA3XHU1MUM2XHU5NTE5XHU4QkVGXHU0RThCXHU0RUY2XHVGRjBDXHU1RTI2XHU1MzlGXHU1NkUwXHU0RTBFXHU4OUUzXHU5MUNBXHJcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKHtcclxuICAgICAgICBtZXNzYWdlOiBgXHU1REU1XHU1MTc3ICR7bmFtZX0gXHU2MjY3XHU4ODRDXHU1RjAyXHU1RTM4OiAke21zZ31gLFxyXG4gICAgICAgIGNvZGU6IFwiVE9PTF9FWENFUFRJT05cIixcclxuICAgICAgICByZWFzb246IFwidW5jYXVnaHQtZXhjZXB0aW9uXCIsXHJcbiAgICAgICAgcmF3OiBtc2csXHJcbiAgICAgICAgZXhwbGFuYXRpb246IGBcdTVERTVcdTUxNzcgJHtuYW1lfSBcdTU3MjhcdTYyNjdcdTg4NENcdTY1RjZcdTYyOUJcdTUxRkFcdTY3MkFcdTYzNTVcdTgzQjdcdTVGMDJcdTVFMzhcdTMwMDJgLCBcclxuICAgICAgICBzdWdnZXN0aW9uOiBcIlx1NjhDMFx1NjdFNVx1NTNDMlx1NjU3MFx1NjYyRlx1NTQyNlx1NTQwOFx1NkNENVx1MzAwMVx1NkQ0Rlx1ODlDOFx1NTY2OFx1NjYyRlx1NTQyNlx1NTNFRlx1NzUyOFx1MzAwMVx1N0Y1MVx1N0VEQ1x1NjYyRlx1NTQyNlx1OEZERVx1OTAxQVx1RkYxQlx1NTNFRlx1NTE0OCBvYnNlcnZlIFx1Nzg2RVx1OEJBNFx1OTg3NVx1OTc2Mlx1NzJCNlx1NjAwMVx1MzAwMlwiLFxyXG4gICAgICAgIGRldGFpbDogZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgZXJyLnN0YWNrID8gZXJyLnN0YWNrLnNsaWNlKDAsIDUwMCkgOiB1bmRlZmluZWQsXHJcbiAgICAgIH0pO1xyXG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLmF0dGFjaEV2ZW50cyhlcnJSZXN1bHQoYFx1NURFNVx1NTE3N1x1NjI2N1x1ODg0Q1x1NTkzMVx1OEQyNTogJHttc2d9YCksIG5hbWUpO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIFx1NjI4QVx1NjcwMFx1OEZEMVx1NEU4Qlx1NEVGNlx1OTY0NFx1NTJBMFx1NTIzMCBUb29sUmVzdWx0LnN0cnVjdHVyZWRcdUZGMENcdTRGOUJcdTU5MTZcdTkwRTggQUkgXHU2RDg4XHU4RDM5XHU0RThCXHU0RUY2XHU2RDQxICovXHJcbiAgcHJpdmF0ZSBhdHRhY2hFdmVudHMocmVzdWx0OiBUb29sUmVzdWx0LCBfbmFtZTogc3RyaW5nKTogVG9vbFJlc3VsdCB7XHJcbiAgICBpZiAoIXJlc3VsdC5zdHJ1Y3R1cmVkKSByZXN1bHQuc3RydWN0dXJlZCA9IHt9O1xyXG4gICAgY29uc3QgZXZlbnRzID0gdGhpcy5sb2dnZXIudG9BcnJheSgpLnNsaWNlKC0zMCk7XHJcbiAgICAocmVzdWx0LnN0cnVjdHVyZWQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLmV2ZW50cyA9IGV2ZW50cztcclxuICAgIChyZXN1bHQuc3RydWN0dXJlZCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuc2Vzc2lvbklkID0gdGhpcy5sb2dnZXIuc2Vzc2lvbklkO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKiBcdTk2OTBcdTg1Q0ZcdTY1NEZcdTYxMUZcdTUzQzJcdTY1NzBcdUZGMDhcdTkwN0ZcdTUxNERcdTYyOEEgdmFsdWUvc2NyaXB0L3VybCBcdTRFMkRcdTc2ODRcdTY1NEZcdTYxMUZcdTRGRTFcdTYwNkZcdTUxNjhcdTY1ODdcdTU4NUVcdTUxNjVcdTY1RTVcdTVGRDdcdUZGMDkgKi9cclxuICBwcml2YXRlIHNhZmVBcmdzKGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xyXG4gICAgY29uc3Qgc2FmZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcclxuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGFyZ3MpKSB7XHJcbiAgICAgIGlmIChrID09PSBcInZhbHVlXCIgfHwgayA9PT0gXCJzY3JpcHRcIikgc2FmZVtrXSA9IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gYDwke3YubGVuZ3RofSBjaGFycz5gIDogdjtcclxuICAgICAgZWxzZSBpZiAoayA9PT0gXCJ1cmxcIiAmJiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIikgc2FmZVtrXSA9IHJlZGFjdFVybCh2KTtcclxuICAgICAgZWxzZSBpZiAoayA9PT0gXCJleHBlY3RlZFwiICYmIHR5cGVvZiB2ID09PSBcInN0cmluZ1wiKSBzYWZlW2tdID0gdi5sZW5ndGggPiA2MCA/IGAke3Yuc2xpY2UoMCwgNjApfS4uLmAgOiB2O1xyXG4gICAgICBlbHNlIHNhZmVba10gPSB2O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHNhZmU7XHJcbiAgfVxyXG5cclxuICAvKiogXHU1MkE4XHU0RjVDXHU3QzdCXHU1NzhCIC0+IFx1N0EzM1x1NUI5QVx1OTUxOVx1OEJFRlx1NzgwMSAqL1xyXG4gIHByaXZhdGUgbWFwRXJyb3JDb2RlKHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYEFDVElPTl9GQUlMRURfJHt0eXBlLnRvVXBwZXJDYXNlKCl9YDtcclxuICB9XHJcblxyXG4gIC8qKiBcdTRFQ0VcdTY0NThcdTg5ODEvXHU4QkNBXHU2NUFEXHU2M0E4XHU2NUFEXHU2ODM5XHU1NkUwXHU1MjA2XHU3QzdCICovXHJcbiAgcHJpdmF0ZSBtYXBFcnJvclJlYXNvbihzdW1tYXJ5OiBzdHJpbmcsIGRpYWdub3N0aWNzPzogQXJyYXk8eyBraW5kPzogc3RyaW5nOyBtZXNzYWdlOiBzdHJpbmcgfT4pOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcyA9IHN1bW1hcnkudG9Mb3dlckNhc2UoKTtcclxuICAgIGlmIChzLmluY2x1ZGVzKFwidGltZW91dFwiKSB8fCBzLmluY2x1ZGVzKFwiXHU4RDg1XHU2NUY2XCIpKSByZXR1cm4gXCJ0aW1lb3V0XCI7XHJcbiAgICBpZiAocy5pbmNsdWRlcyhcIjQwNFwiKSB8fCBzLmluY2x1ZGVzKFwiNTAwXCIpIHx8IHMuaW5jbHVkZXMoXCJuZXR3b3JrXCIpIHx8IHMuaW5jbHVkZXMoXCJcdTdGNTFcdTdFRENcIikpIHJldHVybiBcIm5ldHdvcmstZmFpbHVyZVwiO1xyXG4gICAgaWYgKHMuaW5jbHVkZXMoXCJub3QgZm91bmRcIikgfHwgcy5pbmNsdWRlcyhcIlx1NjI3RVx1NEUwRFx1NTIzMFwiKSB8fCBzLmluY2x1ZGVzKFwiXHU2NUUwXHU2Q0Q1XHU1QjlBXHU0RjREXCIpIHx8IHMuaW5jbHVkZXMoXCJcdTY3MkFcdTYyN0VcdTUyMzBcIikgfHwgcy5pbmNsdWRlcyhcImxvY2F0b3JcIikpIHJldHVybiBcImxvY2F0b3Itbm90LWZvdW5kXCI7XHJcbiAgICBpZiAoZGlhZ25vc3RpY3M/LnNvbWUoKGQpID0+IGQua2luZCA9PT0gXCJqcy1leGNlcHRpb25cIikpIHJldHVybiBcImpzLWV4Y2VwdGlvblwiO1xyXG4gICAgaWYgKGRpYWdub3N0aWNzPy5zb21lKChkKSA9PiBkLmtpbmQgPT09IFwiZG9tXCIpKSByZXR1cm4gXCJkb20tdW5yZW5kZXJlZFwiO1xyXG4gICAgcmV0dXJuIFwiYWN0aW9uLWZhaWxlZFwiO1xyXG4gIH1cclxuXHJcbiAgLyoqIFx1OTc2Mlx1NTQxMSBBSSBcdTc2ODRcdTY4MzlcdTU2RTBcdTg5RTNcdTkxQ0EgKi9cclxuICBwcml2YXRlIGJ1aWxkRXhwbGFuYXRpb24oc3VtbWFyeTogc3RyaW5nLCBkaWFnbm9zdGljcz86IEFycmF5PHsga2luZD86IHN0cmluZzsgbWVzc2FnZTogc3RyaW5nIH0+KTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHJlYXNvbiA9IHRoaXMubWFwRXJyb3JSZWFzb24oc3VtbWFyeSwgZGlhZ25vc3RpY3MpO1xyXG4gICAgY29uc3QgZXh0cmFzID0gKGRpYWdub3N0aWNzID8/IFtdKS5zbGljZSgwLCAzKS5tYXAoKGQpID0+IGQubWVzc2FnZSkuam9pbihcIjsgXCIpO1xyXG4gICAgc3dpdGNoIChyZWFzb24pIHtcclxuICAgICAgY2FzZSBcImxvY2F0b3Itbm90LWZvdW5kXCI6XHJcbiAgICAgICAgcmV0dXJuIGBcdTk4NzVcdTk3NjJcdTRFMkRcdTY3MkFcdTYyN0VcdTUyMzBcdTc2RUVcdTY4MDdcdTUxNDNcdTdEMjBcdTMwMDIke2V4dHJhcyA/IGBcdThCQ0FcdTY1QURcdTYzRDBcdTc5M0E6ICR7ZXh0cmFzfWAgOiBcIlx1NTNFRlx1ODBGRFx1NjYyRlx1NTE0M1x1N0QyMFx1NjcyQVx1NkUzMlx1NjdEM1x1MzAwMVx1OTAwOVx1NjJFOVx1NTY2OFx1NTNEOFx1NTMxNlx1MzAwMVx1NjIxNlx1OTg3NVx1OTc2Mlx1OEZEOFx1NTcyOFx1NTJBMFx1OEY3RFx1MzAwMlwifWA7XHJcbiAgICAgIGNhc2UgXCJ0aW1lb3V0XCI6XHJcbiAgICAgICAgcmV0dXJuIGBcdTY0Q0RcdTRGNUNcdThEODVcdTY1RjZcdUZGMENcdTUxNDNcdTdEMjBcdTYyMTZcdTVCRkNcdTgyMkFcdTU3MjhcdTk2NTBcdTVCOUFcdTY1RjZcdTk1RjRcdTUxODVcdTY3MkFcdTVDMzFcdTdFRUFcdTMwMDIke2V4dHJhcyA/IGBcdThCQ0FcdTY1QURcdTYzRDBcdTc5M0E6ICR7ZXh0cmFzfWAgOiBcIlwifWA7XHJcbiAgICAgIGNhc2UgXCJuZXR3b3JrLWZhaWx1cmVcIjpcclxuICAgICAgICByZXR1cm4gYFx1N0Y1MVx1N0VEQ1x1OEJGN1x1NkM0Mlx1NTkzMVx1OEQyNVx1NjIxNlx1NzZFRVx1NjgwN1x1NEUwRFx1NTNFRlx1OEZCRVx1MzAwMiR7ZXh0cmFzID8gYFx1OEJDQVx1NjVBRFx1NjNEMFx1NzkzQTogJHtleHRyYXN9YCA6IFwiXCJ9YDtcclxuICAgICAgY2FzZSBcImpzLWV4Y2VwdGlvblwiOlxyXG4gICAgICAgIHJldHVybiBgXHU5ODc1XHU5NzYyXHU2MjlCXHU1MUZBXHU0RTg2IEpTIFx1NjcyQVx1NjM1NVx1ODNCN1x1NUYwMlx1NUUzOFx1RkYwQ1x1NTNFRlx1ODBGRFx1OTYzQlx1NjVBRFx1NEVBNFx1NEU5Mlx1MzAwMiR7ZXh0cmFzID8gYFx1OEJDQVx1NjVBRFx1NjNEMFx1NzkzQTogJHtleHRyYXN9YCA6IFwiXCJ9YDtcclxuICAgICAgY2FzZSBcImRvbS11bnJlbmRlcmVkXCI6XHJcbiAgICAgICAgcmV0dXJuIGBcdTk4NzVcdTk3NjIgRE9NIFx1NjcyQVx1NkI2M1x1NUUzOFx1NkUzMlx1NjdEM1x1RkYwOFx1NzY3RFx1NUM0Ri9cdTY3MkFcdTYzMDJcdThGN0RcdUZGMDlcdUZGMENcdTUyMURcdTU5Q0JcdTUzMTYgSlMgXHU1M0VGXHU4MEZEXHU1MUZBXHU5NTE5XHUzMDAyYDtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gYFx1NTJBOFx1NEY1Q1x1NjI2N1x1ODg0Q1x1NTkzMVx1OEQyNTogJHtzdW1tYXJ5LnNsaWNlKDAsIDIwMCl9YDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKiBcdTUzRUZcdTg4NENcdTUyQThcdTc2ODRcdTRGRUVcdTU5MERcdTVFRkFcdThCQUUgKi9cclxuICBwcml2YXRlIGJ1aWxkU3VnZ2VzdGlvbihzdW1tYXJ5OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcmVhc29uID0gdGhpcy5tYXBFcnJvclJlYXNvbihzdW1tYXJ5KTtcclxuICAgIHN3aXRjaCAocmVhc29uKSB7XHJcbiAgICAgIGNhc2UgXCJsb2NhdG9yLW5vdC1mb3VuZFwiOlxyXG4gICAgICAgIHJldHVybiBcIlx1NTE0OCBvYnNlcnZlIFx1NjdFNVx1NzcwQlx1NUY1M1x1NTI0RCBET01cdUZGMENcdTUyMDdcdTYzNjJcdTVCOUFcdTRGNERcdTdCNTZcdTc1NjUocmVmXHUyMTkyc2VsZWN0b3JcdTIxOTJ0ZXh0XHUyMTkyc2VtYW50aWMpXHVGRjBDXHU2MjE2IHdhaXQgXHU1MTQzXHU3RDIwXHU1QzMxXHU3RUVBXHU1NDBFXHU5MUNEXHU4QkQ1XHUzMDAyXCI7XHJcbiAgICAgIGNhc2UgXCJ0aW1lb3V0XCI6XHJcbiAgICAgICAgcmV0dXJuIFwiXHU2OEMwXHU2N0U1XHU5ODc1XHU5NzYyXHU1MkEwXHU4RjdEL1x1N0Y1MVx1N0VEQ1x1RkYwQ1x1NTNFRlx1NUVGNlx1OTU3RiB3YWl0IFx1NjIxNlx1NjUzOVx1NzUyOCB3YWl0VW50aWwgXHU3QjU2XHU3NTY1XHVGRjFCXHU4MkU1XHU1MTQzXHU3RDIwXHU2NjJGXHU1RjAyXHU2QjY1XHU2RTMyXHU2N0QzXHVGRjBDXHU1MTQ4XHU3QjQ5XHU1MTc2XHU1MUZBXHU3M0IwXHUzMDAyXCI7XHJcbiAgICAgIGNhc2UgXCJuZXR3b3JrLWZhaWx1cmVcIjpcclxuICAgICAgICByZXR1cm4gXCJcdTY4MzhcdTVCRjkgVVJML1x1NjNBNVx1NTNFM1x1OERFRlx1NUY4NFx1MzAwMUNPUlMgXHU0RTBFXHU1NDBFXHU3QUVGXHU3MkI2XHU2MDAxXHVGRjFCXHU1RkM1XHU4OTgxXHU2NUY2XHU3NTI4IGRpYWdub3NlIFx1NjdFNVx1NzcwQlx1N0Y1MVx1N0VEQ1x1NTkzMVx1OEQyNVx1OEJFNlx1NjBDNVx1MzAwMlwiO1xyXG4gICAgICBjYXNlIFwianMtZXhjZXB0aW9uXCI6XHJcbiAgICAgICAgcmV0dXJuIFwiXHU3NTI4IGRpYWdub3NlIFx1NUM1NVx1NUYwMFx1NUYwMlx1NUUzOFx1NTgwNlx1NjgwOFx1RkYwQ1x1NUI5QVx1NEY0RCB0aHJvdy9cdTY3MkFcdTVCOUFcdTRFNDkvXHU1RjAyXHU2QjY1XHU2NzJBIGNhdGNoXHVGRjBDXHU0RkVFXHU1OTBEXHU1NDBFXHU5MUNEXHU4QkQ1XHUzMDAyXCI7XHJcbiAgICAgIGNhc2UgXCJkb20tdW5yZW5kZXJlZFwiOlxyXG4gICAgICAgIHJldHVybiBcIlx1NjhDMFx1NjdFNVx1NTIxRFx1NTlDQlx1NTMxNiBKUyBcdTY2MkZcdTU0MjZcdTYyOUJcdTk1MTlcdTVCRkNcdTgxRjRcdTY1NzRcdTY4MTFcdTY3MkFcdTZFMzJcdTY3RDNcdUZGMUJcdTc1MjggZGlhZ25vc2UgXHU3Njg0IGRvbSBcdTdFRjRcdTVFQTZcdTVCOUFcdTRGNERcdTc2N0RcdTVDNEZcdTY4MzlcdTU2RTBcdTMwMDJcIjtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gXCJcdTc1MjggZGlhZ25vc2UgXHU5MUM3XHU5NkM2XHU1QjhDXHU2NTc0XHU4QkNBXHU2NUFEXHVGRjBDXHU3RUQzXHU1NDA4XHU2NUU1XHU1RkQ3XHU0RThCXHU0RUY2XHU1QjlBXHU0RjREXHU2ODM5XHU1NkUwXHU1NDBFXHU0RkVFXHU2QjYzXHU1MkE4XHU0RjVDXHUzMDAyXCI7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiogXHU2MjhBXHU2MjQxXHU1RTczXHU1M0MyXHU2NTcwXHU4OUM0XHU2NTc0XHU0RTNBXHU3RURGXHU0RTAwXHU1MkE4XHU0RjVDICovXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVBY3Rpb24oYXJnczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XHJcbiAgICBjb25zdCB0eXBlID0gU3RyaW5nKGFyZ3MudHlwZSk7XHJcbiAgICBjb25zdCBiYXNlID0geyB0eXBlLCBkZXNjcmlwdGlvbjogYXJncy5kZXNjcmlwdGlvbiBhcyBzdHJpbmcgfCB1bmRlZmluZWQgfTtcclxuICAgIC8vIFx1NTNFQVx1NjQzQVx1NUUyNlx1NUI5QVx1NEY0RFx1NzZGOFx1NTE3M1x1NUI1N1x1NkJCNVx1RkYwOFx1OTA3Rlx1NTE0RFx1NjI4QSB1bmRlZmluZWQgXHU1ODVFXHU1MTY1XHVGRjA5XHJcbiAgICBjb25zdCBsb2M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XHJcbiAgICBpZiAoYXJncy5yZWYpIGxvYy5yZWYgPSBhcmdzLnJlZjtcclxuICAgIGlmIChhcmdzLnNlbGVjdG9yKSBsb2Muc2VsZWN0b3IgPSBhcmdzLnNlbGVjdG9yO1xyXG4gICAgaWYgKGFyZ3MudGV4dCkgbG9jLnRleHQgPSBhcmdzLnRleHQ7XHJcbiAgICBpZiAoYXJncy5zZW1hbnRpYykgbG9jLnNlbWFudGljID0gYXJncy5zZW1hbnRpYztcclxuXHJcbiAgICBjb25zdCByZXN0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xyXG4gICAgZm9yIChjb25zdCBrIG9mIFtcInVybFwiLCBcInZhbHVlXCIsIFwia2V5XCIsIFwibXNcIiwgXCJzY3JpcHRcIiwgXCJtb2RlXCIsIFwiZXhwZWN0ZWRcIiwgXCJmdWxsUGFnZVwiLCBcImRlbHRhWVwiLCBcImRlbGF5XCIsIFwid2FpdFVudGlsXCIsIFwid2FpdEZvck5hdmlnYXRpb25cIl0pIHtcclxuICAgICAgaWYgKGFyZ3Nba10gIT09IHVuZGVmaW5lZCkgcmVzdFtrXSA9IGFyZ3Nba107XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyAuLi5iYXNlLCAuLi5sb2MsIC4uLnJlc3QgfTtcclxuICB9XHJcblxyXG4gIC8qKiBcdTUxNzNcdTk1RURcdUZGMDhcdTRGOUJcdTRGMjBcdThGOTNcdTVDNDJcdTkwMDBcdTUxRkFcdTY1RjZcdThDMDNcdTc1MjhcdUZGMDkgKi9cclxuICBhc3luYyBzaHV0ZG93bigpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLmJyb3dzZXIpIGF3YWl0IHRoaXMuYnJvd3Nlci5zdG9wKCk7XHJcbiAgfVxyXG59XHJcbiIsICIvKipcbiAqIFx1OTUxOVx1OEJFRlx1ODFFQVx1NTJBOFx1NTMzOVx1OTE0RFx1ODlFM1x1NTFCM1x1NjVCOVx1Njg0OFx1NUYxNVx1NjRDRVx1RkYwOFNvbHV0aW9uIE1hdGNoZXJcdUZGMDlcbiAqXG4gKiBcdThGRDlcdTY2MkZcdTMwMENjbmIuY29vbCBcdTU3MjhcdTdFQkZcdTRGMThcdTUyQkZcdTMwMERcdTc2ODRcdTY4MzhcdTVGQzNcdTUzNDdcdTdFQTdcdUZGMUFcdTVGNTNcdThDMDNcdThCRDUvQ0kgXHU4RkM3XHU3QTBCXHU0RTJEXHU1MUZBXHU3M0IwXHU5NUVFXHU5ODk4XHU2NUY2XHVGRjBDXG4gKiBcdTYyOEFcdTMwMENcdTk1RUVcdTk4OThcdTYwQzVcdTUxQjVcdTMwMERcdTY4QzBcdTdEMjJcdTUzMzlcdTkxNERcdTUyMzBcdTUxODVcdTdGNkVcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTc3RTVcdThCQzZcdTVFOTNcdUZGMDhwbGF5Ym9va1x1RkYwOVx1RkYwQ1x1NjNBOFx1ODM1MFx1NEUwMFx1NEUyQVx1NjVCOVx1Njg0OFx1RkYxQVxuICpcbiAqIC0gKipcdTdCODBcdTUzNTVcdTk1RUVcdTk4OThcdUZGMDhsZXZlbDogXCJhdXRvXCJcdUZGMDkqKiBcdTIxOTIgXHU3NkY0XHU2M0E1XHU2ODA3XHU1MUM2XHU1MzE2XHU4MUVBXHU1MkE4XHU1MzE2XHVGRjBDXHU4RkQ0XHU1NkRFXHU1M0VGXHU3NkY0XHU2M0E1XHU4NDNEXHU1NzMwXHU3Njg0XHU0RkVFXHU1OTBEXHU1MkE4XHU0RjVDXHVGRjBDXG4gKiAgIFx1NTNDRFx1OTk4OFx1NTM3M1x1N0VEM1x1Njc5Q1x1RkYwQ1x1NEUwRFx1NTJCM1x1NzBFNlx1NEVCQVx1NURFNVx1MzAwMlxuICogLSAqKlx1NTkwRFx1Njc0Mlx1OTVFRVx1OTg5OFx1RkYwOGxldmVsOiBcImd1aWRlXCJcdUZGMDkqKiBcdTIxOTIgXHU4QkM2XHU1MjJCXHU5NUVFXHU5ODk4XHU3QzdCXHU1NzhCXHU1NDBFXHVGRjBDXHU2M0E4XHU4MzUwXHU1QkY5XHU1RTk0XHU3Njg0XHU2QTIxXHU1NzU3IHNraWxsIC9cbiAqICAgXHU1RjAwXHU2RTkwXHU5ODc5XHU3NkVFIC8gXHU4OUUzXHU1MUIzXHU2MDFEXHU4REVGXHVGRjBDXHU2MjhBXHUzMDBDXHU2Q0ExXHU1RjgwXHU4RkQ5XHU5MUNDXHU2MEYzXHUzMDBEXHU3Njg0XHU1NkYwXHU1ODgzXHU3MEI5XHU3ODM0XHUzMDAyXG4gKlxuICogXHU1MTczXHU5NTJFXHU4QkJFXHU4QkExIFx1MjAxNFx1MjAxNCAqKlx1OTFDRFx1NTkwRFx1OTUxOVx1OEJFRlx1NEU4Q1x1NkIyMVx1ODlFNlx1NTNEMVx1RkYwOHJlcGVhdC10cmlnZ2VyXHVGRjA5KipcdUZGMUFcbiAqIFx1NEUzQVx1OTA3Rlx1NTE0RFx1NkJDRlx1NkIyMVx1OTBGRFx1NjI1M1x1NjI3MFx1RkYwQ1x1NTQwQ1x1NEUwMFx1N0M3Qlx1OTUxOVx1OEJFRlx1RkYwOFx1NzUyOCoqXHU5NTE5XHU4QkVGXHU2MzA3XHU3RUI5KipcdTVGNTJcdTRFMDBcdTUzMTZcdThCQzZcdTUyMkJcdUZGMDkqKlx1NTFGQVx1NzNCMCAyIFx1NkIyMSoqXHU2MjREXHU4OUU2XHU1M0QxXG4gKiBcdTUzMzlcdTkxNERcdTY3M0FcdTUyMzYgXHUyMDE0XHUyMDE0XHUzMDBDXHU0RTBEXHU1OTFBXHU0RjU5XHVGRjBDXHU0RTVGXHU0RTBEXHU1NkYwXHU1ODgzXHUzMDBEXHVGRjFBXG4gKiAtIFx1N0IyQyAxIFx1NkIyMVx1RkYxQVx1NEVDNVx1OTc1OVx1OUVEOFx1OEJCMFx1NUY1NVx1RkYwOFx1OEJBMVx1NjU3MFx1RkYwOVx1RkYwQ1x1NEUwRFx1NEUzQlx1NTJBOFx1NUYzOVx1NTFGQVx1NjVCOVx1Njg0OFx1RkYwQ1x1OTA3Rlx1NTE0RFx1NTY2QVx1OTdGM1x1RkYxQlxuICogLSBcdTdCMkMgMiBcdTZCMjFcdUZGMUFcdTg5RTZcdTUzRDFcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTYzQThcdTgzNTBcdUZGMDhhdXRvIFx1NzZGNFx1NjNBNVx1NjI2N1x1ODg0QyAvIGd1aWRlIFx1NjNBOFx1ODM1MFx1NjAxRFx1OERFRlx1RkYwOVx1MzAwMlxuICpcbiAqIFx1NTE4NVx1N0Y2RSBwbGF5Ym9vayBcdTg5ODZcdTc2RDZcdTVFMzhcdTg5QzFcdTc2ODRcdTZENEZcdTg5QzhcdTU2NjgvXHU1MjREXHU3QUVGXHU4QzAzXHU4QkQ1XHU5NUVFXHU5ODk4XHVGRjA4XHU3RjUxXHU3RURDXHUzMDAxXHU2M0E3XHU1MjM2XHU1M0YwXHUzMDAxSlMgXHU1RjAyXHU1RTM4XHUzMDAxRE9NIFx1NUI5QVx1NEY0RFx1MzAwMVxuICogXHU2MDI3XHU4MEZEXHUzMDAxXHU4REU4XHU1N0RGXHU3QjQ5XHVGRjA5XHVGRjBDXHU1RTc2XHU0RTBFXHU5ODc5XHU3NkVFXHU4MUVBXHU4RUFCXHU3N0U1XHU4QkM2XHU1RTkzXHVGRjA4YnVpbGRLbm93bGVkZ2VDb250ZXh0XHVGRjA5XHU0RTkyXHU4ODY1XHUzMDAyXG4gKi9cbmltcG9ydCBmcyBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xuXG4vKiogXHU5NUVFXHU5ODk4XHU0RTI1XHU5MUNEXHU3RUE3XHU1MjJCICovXG5leHBvcnQgdHlwZSBTb2x1dGlvbkxldmVsID0gXCJhdXRvXCIgfCBcImd1aWRlXCI7XG5cbi8qKiBcdTRFMDBcdTY3NjFcdTUxODVcdTdGNkVcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDggKi9cbmV4cG9ydCBpbnRlcmZhY2UgU29sdXRpb25FbnRyeSB7XG4gIC8qKiBcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTY4MDdcdThCQzZcdUZGMDhcdTc1MjhcdTRFOEVcdTUzQkJcdTkxQ0QgLyBcdTVGMTVcdTc1MjhcdUZGMDkgKi9cbiAgaWQ6IHN0cmluZztcbiAgLyoqIFx1NTMzOVx1OTE0RFx1NTIzMFx1NzY4NFx1OTUxOVx1OEJFRlx1NjMwN1x1N0VCOSAqL1xuICBmaW5nZXJwcmludDogc3RyaW5nO1xuICAvKiogXHU5NUVFXHU5ODk4XHU0RTAwXHU1M0U1XHU4QkREXHU2M0NGXHU4RkYwICovXG4gIHRpdGxlOiBzdHJpbmc7XG4gIC8qKiBcdTk1RUVcdTk4OThcdTc2ODRcdTZCNjNcdTUyMTlcdTUzMzlcdTkxNERcdTZBMjFcdTVGMEZcdUZGMDhcdTVCRjlcdTUzOUZcdTU5Q0JcdTk1MTlcdThCRUYvXHU4QkNBXHU2NUFEXHU2NTg3XHU2NzJDXHU1MzM5XHU5MTREXHVGRjA5ICovXG4gIHBhdHRlcm46IFJlZ0V4cDtcbiAgLyoqIFx1NjVCOVx1Njg0OFx1N0VBN1x1NTIyQlx1RkYxQWF1dG89XHU2ODA3XHU1MUM2XHU1MzE2XHU4MUVBXHU1MkE4XHU1MzE2XHU3NkY0XHU2M0E1XHU2MjY3XHU4ODRDXHVGRjFCZ3VpZGU9XHU2M0E4XHU4MzUwXHU2MDFEXHU4REVGL3NraWxsL1x1NUYwMFx1NkU5MFx1OTg3OVx1NzZFRSAqL1xuICBsZXZlbDogU29sdXRpb25MZXZlbDtcbiAgLyoqIFx1ODlFM1x1NTFCM1x1NjVCOVx1Njg0OFx1NkI2M1x1NjU4N1x1RkYwOGF1dG8gXHU2NUY2XHU0RTNBXHU1M0VGXHU2MjY3XHU4ODRDXHU2QjY1XHU5QUE0XHVGRjBDZ3VpZGUgXHU2NUY2XHU0RTNBXHU2MDFEXHU4REVGL1x1OTg3OVx1NzZFRVx1RkYwOSAqL1xuICBzb2x1dGlvbjogc3RyaW5nO1xuICAvKiogXHU1RjUzIGxldmVsPWd1aWRlIFx1NjVGNlx1NjNBOFx1ODM1MFx1NzY4NFx1NTE3N1x1NEY1M1x1ODQzRFx1NTczMFx1NjVCOVx1NUYwRiAqL1xuICBza2lsbD86IHN0cmluZztcbiAgLyoqIFx1NUY1MyBsZXZlbD1ndWlkZSBcdTY1RjZcdTYzQThcdTgzNTBcdTc2ODRcdTZBMjFcdTU3NTcgLyBcdTVGMDBcdTZFOTBcdTk4NzlcdTc2RUUgKi9cbiAgb3BlblNvdXJjZT86IHN0cmluZztcbiAgLyoqIFx1ODlFNlx1NTNEMVx1OTYwOFx1NTAzQ1x1RkYxQVx1NTQwQ1x1NjMwN1x1N0VCOVx1NTFGQVx1NzNCMFx1NTFFMFx1NkIyMVx1NTQwRVx1NjNBOFx1ODM1MFx1RkYwOFx1OUVEOFx1OEJBNCAyXHVGRjA5ICovXG4gIHRyaWdnZXJBZnRlcj86IG51bWJlcjtcbiAgLyoqIFx1NTE3M1x1OTUyRVx1OEJDRFx1RkYxQVx1NzUyOFx1NEU4RSBmaW5nZXJwcmludCBcdTUyMjRcdTVCOUFcdTRFNEJcdTU5MTZcdTc2ODRcdThGODVcdTUyQTlcdTUzMzlcdTkxNEQgKi9cbiAga2V5d29yZHM/OiBzdHJpbmdbXTtcbiAgLyoqIFx1NjVCOVx1Njg0OFx1Njc2NVx1NkU5MFx1NjgwN1x1NkNFOFx1RkYwOFx1OUVEOFx1OEJBNCBzb2x1dGlvbnMtcmVwb1x1RkYxQlx1NTNFRlx1NzUyOFx1NEU4RVx1NzdFNVx1OEJDNlx1NEUwQVx1NEUwQlx1NjU4N1x1NkVBRlx1NkU5MFx1RkYwOSAqL1xuICBzb3VyY2U/OiBzdHJpbmc7XG59XG5cbi8qKiBcdTUzMzlcdTkxNERcdTdFRDNcdTY3OUMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgU29sdXRpb25NYXRjaCB7XG4gIC8qKiBcdTY2MkZcdTU0MjZcdTg5RTZcdTUzRDFcdTYzQThcdTgzNTAgKi9cbiAgdHJpZ2dlcmVkOiBib29sZWFuO1xuICAvKiogXHU5NTE5XHU4QkVGXHU2MzA3XHU3RUI5ICovXG4gIGZpbmdlcnByaW50OiBzdHJpbmc7XG4gIC8qKiBcdTVERjJcdTUxRkFcdTczQjBcdTZCMjFcdTY1NzAgKi9cbiAgb2NjdXJyZW5jZXM6IG51bWJlcjtcbiAgLyoqIFx1NTQ3RFx1NEUyRFx1NzY4NFx1NjVCOVx1Njg0OFx1RkYwOHRyaWdnZXJlZD10cnVlIFx1NjVGNlx1NUI1OFx1NTcyOFx1RkYwOSAqL1xuICBlbnRyeT86IFNvbHV0aW9uRW50cnk7XG4gIC8qKiBcdTU0N0RcdTRFMkRcdTc2ODRcdTY1QjlcdTY4NDhcdTY1ODdcdTY3MkNcdUZGMDhcdTRGOUJcdTZDRThcdTUxNjVcdThDMDNcdThCRDVcdTRFMEFcdTRFMEJcdTY1ODcgLyBcdTUzQ0RcdTk5ODhcdUZGMDkgKi9cbiAgYWR2aWNlPzogc3RyaW5nO1xuICAvKiogXHU2NjJGXHU1NDI2XHU1REYyXHU1QzFEXHU4QkQ1XHU4MUVBXHU1MkE4XHU0RkVFXHU1OTBEXHVGRjA4YXV0byBcdTdFQTdcdTUyMkJcdUZGMDkgKi9cbiAgYXV0b0FwcGxpZWQ/OiBib29sZWFuO1xufVxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFx1NTE4NVx1N0Y2RVx1ODlFM1x1NTFCM1x1NjVCOVx1Njg0OFx1NzdFNVx1OEJDNlx1NUU5M1x1RkYwOHBsYXlib29rXHVGRjA5XG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbi8qKlxuICogXHU1MTg1XHU3RjZFIHBsYXlib29rXHVGRjFBXHU2MjhBXHU1RTM4XHU4OUMxXHU1MjREXHU3QUVGL1x1NkQ0Rlx1ODlDOFx1NTY2OFx1OEMwM1x1OEJENVx1OTVFRVx1OTg5OFx1NjYyMFx1NUMwNFx1NTIzMFx1ODlFM1x1NTFCM1x1NjVCOVx1Njg0OFx1MzAwMlxuICogXHU4RkQ5XHU2NjJGXHUzMDBDXHU0RTBEXHU5NzYwXHU4OEY4XHU1REU1XHU1MTc3XHUzMDBEXHU3Njg0XHU3N0U1XHU4QkM2XHU2Qzg5XHU2REMwIFx1MjAxNFx1MjAxNCBcdTVGODhcdTU5MUFcdTk1RUVcdTk4OThcdTUxNzZcdTVCOUVcdTY3MDlcdTYyMTBcdTcxOUZcdTg5RTNcdUZGMENcdTUzRUFcdTY2MkZcdTVGMDBcdTUzRDFcdTY1RjZcdTZDQTFcdTVGODBcdThGRDlcdTkxQ0NcdTYwRjNcdTMwMDJcbiAqL1xuZXhwb3J0IGNvbnN0IFNPTFVUSU9OX1BMQVlCT09LOiBTb2x1dGlvbkVudHJ5W10gPSBbXG4gIHtcbiAgICBpZDogXCJuZXQtNDA0LTUwMFwiLFxuICAgIGZpbmdlcnByaW50OiBcIm5ldHdvcms6aHR0cC1lcnJvclwiLFxuICAgIHRpdGxlOiBcIlx1OEQ0NFx1NkU5MC9cdTYzQTVcdTUzRTNcdThCRjdcdTZDNDJcdTU5MzFcdThEMjVcdUZGMDg0MDQvNTAwXHVGRjA5XCIsXG4gICAgcGF0dGVybjogLyg/Olx1N0Y1MVx1N0VEQ1x1NUI1OFx1NTcyOCBcXGQrIFx1NEUyQVx1NTkzMVx1OEQyNVx1OEJGN1x1NkM0MnxcdThCRjdcdTZDNDJcdTU5MzFcdThEMjV8c3RhdHVzICg/OjQwNHw1MDApfDQwNHw1MDApL2ksXG4gICAgbGV2ZWw6IFwiYXV0b1wiLFxuICAgIHNvbHV0aW9uOlxuICAgICAgXCJcdTY4MDdcdTUxQzZcdTUzMTZcdTY4MjFcdTlBOENcdUZGMUFcdTI0NjAgXHU5MDEwXHU0RTJBXHU2ODM4XHU1QkY5XHU1OTMxXHU4RDI1IFVSTCBcdTc2ODRcdThERUZcdTVGODRcdTRFMEVcdTU0MEVcdTdBRUZcdTY2MkZcdTU0MjZcdTVDMzFcdTdFRUFcdUZGMUJcdTI0NjEgXHU4MkU1XHU2NjJGXHU1MjREXHU3QUVGXHU5NzU5XHU2MDAxXHU4RDQ0XHU2RTkwXHVGRjBDXHU2OEMwXHU2N0U1XHU2MjUzXHU1MzA1XHU4REVGXHU1Rjg0IGJhc2UgXHU2NjJGXHU1NDI2XHU2QjYzXHU3ODZFXHVGRjA4Vml0ZSBiYXNlIC8gd2VicGFjayBwdWJsaWNQYXRoXHVGRjA5XHVGRjFCXHUyNDYyIFx1ODJFNVx1NjYyRlx1NjNBNVx1NTNFM1x1RkYwQ1x1NjhDMFx1NjdFNVx1NjcwRFx1NTJBMVx1N0FFRlx1NjYyRlx1NTQyNlx1NURGMlx1NTQyRlx1NTJBOFx1MzAwMVx1OERFRlx1NzUzMVx1NjYyRlx1NTQyNlx1NkNFOFx1NTE4Q1x1MzAwMlwiLFxuICAgIHRyaWdnZXJBZnRlcjogMixcbiAgICBrZXl3b3JkczogW1wiNDA0XCIsIFwiNTAwXCIsIFwiXHU1OTMxXHU4RDI1XHU4QkY3XHU2QzQyXCIsIFwiXHU4QkY3XHU2QzQyXHU1OTMxXHU4RDI1XCJdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwibmV0LWNvcnNcIixcbiAgICBmaW5nZXJwcmludDogXCJuZXR3b3JrOmNvcnNcIixcbiAgICB0aXRsZTogXCJcdThERThcdTU3REZcdUZGMDhDT1JTXHVGRjA5XHU4OEFCXHU5NjNCXHU2NUFEXCIsXG4gICAgcGF0dGVybjogLyg/OmNvcnN8XHU4REU4XHU1N0RGfGFjY2Vzcy1jb250cm9sfG5vICdhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW4nKS9pLFxuICAgIGxldmVsOiBcImd1aWRlXCIsXG4gICAgc29sdXRpb246XG4gICAgICBcIkNPUlMgXHU2NjJGXHU1RTM4XHU4OUMxXHU1NzUxXHVGRjFBXHU1MjREXHU3QUVGXHU3NkY0XHU4RkRFXHU0RTBEXHU1NDBDXHU2RTkwXHU1NDBFXHU3QUVGXHU0RjFBXHU4OEFCXHU2RDRGXHU4OUM4XHU1NjY4XHU2MkU2XHU2MjJBXHUzMDAyXHU2M0E4XHU4MzUwXHU2NUI5XHU2ODQ4XHVGRjFBXHU0RjdGXHU3NTI4XHU2NzJDXHU1NzMwXHU0RUUzXHU3NDA2L1x1NTNDRFx1NTQxMVx1NEVFM1x1NzQwNlx1RkYwOHZpdGUgZGV2IHNlcnZlciBwcm94eSAvIG5naW54XHVGRjA5XHU2MjhBXHU4REU4XHU1N0RGXHU1M0Q4XHU1NDBDXHU2RTkwXHVGRjFCXHU1NDBFXHU3QUVGXHU1MkEwIENPUlMgXHU1OTM0XHVGRjA4QWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXHVGRjA5XHUzMDAyXCIsXG4gICAgc2tpbGw6IFwiY25iLXBpcGVsaW5lXCIsXG4gICAgb3BlblNvdXJjZTogXCJ2aXRlLXByb3h5IC8gbmdpbnggLyBodHRwLXByb3h5LW1pZGRsZXdhcmVcIixcbiAgICB0cmlnZ2VyQWZ0ZXI6IDIsXG4gICAga2V5d29yZHM6IFtcImNvcnNcIiwgXCJcdThERThcdTU3REZcIiwgXCJhY2Nlc3MtY29udHJvbFwiXSxcbiAgfSxcbiAge1xuICAgIGlkOiBcImNvbnNvbGUtanMtZXhjZXB0aW9uXCIsXG4gICAgZmluZ2VycHJpbnQ6IFwiY29uc29sZTpqcy1leGNlcHRpb25cIixcbiAgICB0aXRsZTogXCJcdTYzQTdcdTUyMzZcdTUzRjAgSlMgXHU2NzJBXHU2MzU1XHU4M0I3XHU1RjAyXHU1RTM4XCIsXG4gICAgcGF0dGVybjogLyg/Olx1OTg3NVx1OTc2Mlx1NjI5Qlx1NTFGQVx1NEU4NiBKUyBcdTY3MkFcdTYzNTVcdTgzQjdcdTVGMDJcdTVFMzh8XHU2NzJBXHU2MzU1XHU4M0I3XHU3Njg0fHVuY2F1Z2h0fFR5cGVFcnJvcnxSZWZlcmVuY2VFcnJvcikvaSxcbiAgICBsZXZlbDogXCJhdXRvXCIsXG4gICAgc29sdXRpb246XG4gICAgICBcIlx1NjgwN1x1NTFDNlx1NTMxNlx1NjM5Mlx1OTY5Q1x1RkYxQVx1MjQ2MCBcdTVDNTVcdTVGMDBcdTVGMDJcdTVFMzhcdTU4MDZcdTY4MDhcdTVCOUFcdTRGNEQgdGhyb3cgLyBcdTY3MkFcdTVCOUFcdTRFNDlcdTUzRDhcdTkxQ0YgLyBcdTVGMDJcdTZCNjVcdTY3MkEgY2F0Y2hcdUZGMUJcdTI0NjEgXHU3NTI4IGV2YWwgXHU1NzI4XHU5ODc1XHU5NzYyXHU2Q0U4XHU1MTY1XHU2OEMwXHU2N0U1XHU1MTczXHU5NTJFXHU1M0Q4XHU5MUNGL1x1NUJGOVx1OEM2MVx1NjYyRlx1NTQyNlx1NUI1OFx1NTcyOFx1RkYxQlx1MjQ2MiBcdTRGMThcdTUxNDhcdTRGRUVcdTU5MERcdTY3MDBcdTRFMEFcdTVDNDJcdTY3MkFcdTYzNTVcdTgzQjdcdTVGMDJcdTVFMzhcdUZGMDhcdTkwMUFcdTVFMzhcdTc1MzFcdTVCODNcdTVGMTVcdTUzRDFcdThGREVcdTVFMjZcdTYyQTVcdTk1MTlcdUZGMDlcdTMwMDJcIixcbiAgICB0cmlnZ2VyQWZ0ZXI6IDIsXG4gICAga2V5d29yZHM6IFtcImpzIFx1NUYwMlx1NUUzOFwiLCBcIlx1NjcyQVx1NjM1NVx1ODNCN1wiLCBcInVuY2F1Z2h0XCIsIFwidHlwZWVycm9yXCJdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwiZG9tLWxvY2F0b3ItZmFpbGVkXCIsXG4gICAgZmluZ2VycHJpbnQ6IFwiZG9tOmxvY2F0b3ItZmFpbGVkXCIsXG4gICAgdGl0bGU6IFwiXHU1MTQzXHU3RDIwXHU1QjlBXHU0RjREL1x1NzBCOVx1NTFGQlx1NTkzMVx1OEQyNVwiLFxuICAgIHBhdHRlcm46IC8oPzpcdTY3MkFcdTYyN0VcdTUyMzBcdTUxNDNcdTdEMjB8XHU2NUUwXHU2Q0Q1XHU1QjlBXHU0RjREfFx1NUI5QVx1NEY0RFx1NTkzMVx1OEQyNXxcdTVCOUFcdTRGNEQuKlx1NTkzMVx1OEQyNXxub3QgZm91bmR8bm8gZWxlbWVudHxlbGVtZW50IG5vdCBmb3VuZHxcdTYyN0VcdTRFMERcdTUyMzApL2ksXG4gICAgbGV2ZWw6IFwiYXV0b1wiLFxuICAgIHNvbHV0aW9uOlxuICAgICAgXCJcdTY4MDdcdTUxQzZcdTUzMTZcdTkxQ0RcdThCRDVcdUZGMUFcdTI0NjAgXHU2NTM5XHU3NTI4XHU2NkY0XHU3QTMzXHU1QjlBXHU3Njg0XHU1QjlBXHU0RjREXHU3QjU2XHU3NTY1XHVGRjA4cmVmXHUyMTkyc2VsZWN0b3JcdTIxOTJzZW1hbnRpYyBcdTkwMTBcdTdFQTdcdTk2NERcdTdFQTdcdUZGMDlcdUZGMUJcdTI0NjEgXHU1MTQzXHU3RDIwXHU1M0VGXHU4MEZEXHU1NzI4XHU1RjAyXHU2QjY1XHU2RTMyXHU2N0QzXHU1NDBFXHU1MUZBXHU3M0IwXHVGRjBDXHU1MTQ4IHdhaXQgXHU1MThEXHU2NENEXHU0RjVDXHVGRjFCXHUyNDYyIFx1ODJFNVx1NUYzOVx1N0E5Ny9pZnJhbWUgXHU5MDZFXHU2MzIxXHVGRjBDXHU1MTQ4XHU1MjA3XHU2MzYyIGZyYW1lIFx1NjIxNlx1NTE3M1x1OTVFRFx1NUYzOVx1NUM0Mlx1MzAwMlwiLFxuICAgIHRyaWdnZXJBZnRlcjogMixcbiAgICBrZXl3b3JkczogW1wiXHU2NzJBXHU2MjdFXHU1MjMwXHU1MTQzXHU3RDIwXCIsIFwiXHU2NUUwXHU2Q0Q1XHU1QjlBXHU0RjREXHU1MTQzXHU3RDIwXCIsIFwiXHU1QjlBXHU0RjREXHU1OTMxXHU4RDI1XCIsIFwiZWxlbWVudCBub3QgZm91bmRcIl0sXG4gIH0sXG4gIHtcbiAgICBpZDogXCJwZXJmLXR0ZmItc2xvd1wiLFxuICAgIGZpbmdlcnByaW50OiBcInBlcmZvcm1hbmNlOnR0ZmJcIixcbiAgICB0aXRsZTogXCJcdTYzQTVcdTUzRTNcdTU0Q0RcdTVFOTRcdTYxNjJcdUZGMDhUVEZCIFx1NTA0Rlx1OUFEOFx1RkYwOVwiLFxuICAgIHBhdHRlcm46IC8oPzpUVEZCIFx1NTA0Rlx1OUFEOHxUVEZCLiptc3xcdTYxNjJcdThCRjdcdTZDNDIpL2ksXG4gICAgbGV2ZWw6IFwiZ3VpZGVcIixcbiAgICBzb2x1dGlvbjpcbiAgICAgIFwiXHU2MDI3XHU4MEZEXHU3NEY2XHU5ODg4XHU1RTM4XHU4OUMxXHU4OUUzXHVGRjFBXHUyNDYwIFx1NEYxOFx1NTE0OFx1NjM5Mlx1NjdFNVx1NjcwRFx1NTJBMVx1N0FFRlx1NTkwNFx1NzQwNlx1RkYwOFx1NjU3MFx1NjM2RVx1NUU5M1x1NjdFNVx1OEJFMlx1MzAwMVx1NTQwQ1x1NkI2NVx1OTAzQlx1OEY5MVx1RkYwOVx1NEUwRVx1N0Y1MVx1N0VEQ1x1OTRGRVx1OERFRlx1RkYxQlx1MjQ2MSBcdTUyQTBcdTdGMTNcdTVCNThcdUZGMDhDRE4gLyBcdTY3MERcdTUyQTFcdTdBRUZcdTdGMTNcdTVCNTggLyBIVFRQIFx1N0YxM1x1NUI1OFx1RkYwOVx1RkYxQlx1MjQ2MiBcdTU0MDhcdTVFNzZcdThCRjdcdTZDNDJcdTMwMDFcdTUzOEJcdTdGMjlcdTRGNTNcdTc5RUZcdTMwMDJcdTUzRUZcdTc1MjggUGVyZm9ybWFuY2UgXHU5NzYyXHU2NzdGL1x1OEJDQVx1NjVBRFx1NjJBNVx1NTQ0QVx1NzY4NCBUVEZCIFx1NjJDNlx1NTIwNlx1NUI5QVx1NEY0RFx1NjYyRlx1N0Y1MVx1N0VEQ1x1OEZEOFx1NjYyRlx1NjcwRFx1NTJBMVx1N0FFRlx1NjE2Mlx1MzAwMlwiLFxuICAgIHNraWxsOiBcImNuYi1waXBlbGluZVwiLFxuICAgIG9wZW5Tb3VyY2U6IFwicmVkaXMtY2FjaGUgLyBuZ2lueC1jYWNoZSAvIHZpdGUtYnVuZGxlLWFuYWx5emVyXCIsXG4gICAgdHJpZ2dlckFmdGVyOiAyLFxuICAgIGtleXdvcmRzOiBbXCJ0dGZiXCIsIFwiXHU2MTYyXHU4QkY3XHU2QzQyXCIsIFwiXHU2MDI3XHU4MEZEXCJdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwiZG9tLXNzci1oeWRyYXRpb25cIixcbiAgICBmaW5nZXJwcmludDogXCJkb206aHlkcmF0aW9uLW1pc21hdGNoXCIsXG4gICAgdGl0bGU6IFwiU1NSIFx1NkMzNFx1NTQwOFx1NEUwRFx1NEUwMFx1ODFGNFx1RkYwOGh5ZHJhdGlvbiBtaXNtYXRjaFx1RkYwOVwiLFxuICAgIHBhdHRlcm46IC8oPzpoeWRyYXRpb258XHU2QzM0XHU1NDA4fHNlcnZlci1yZW5kZXJlZCBjb250ZW50fGRpZCBub3QgbWF0Y2gpL2ksXG4gICAgbGV2ZWw6IFwiZ3VpZGVcIixcbiAgICBzb2x1dGlvbjpcbiAgICAgIFwiU1NSIFx1NkMzNFx1NTQwOFx1NEUwRFx1NEUwMFx1ODFGNFx1NjYyRlx1NUUzOFx1ODlDMVx1NTc1MVx1RkYwOFx1NjcwRFx1NTJBMVx1N0FFRlx1NkUzMlx1NjdEMyBET00gXHU0RTBFXHU1QkEyXHU2MjM3XHU3QUVGXHU5OTk2XHU2QjIxXHU2RTMyXHU2N0QzXHU0RTBEXHU0RTAwXHU4MUY0XHVGRjA5XHUzMDAyXHU2M0E4XHU4MzUwXHU2MDFEXHU4REVGXHVGRjFBXHUyNDYwIFx1OTA3Rlx1NTE0RFx1NTcyOFx1NkUzMlx1NjdEM1x1NjcxRlx1OTVGNFx1NEY5RFx1OEQ1Nlx1NkQ0Rlx1ODlDOFx1NTY2OFx1NzJFQ1x1NjcwOSBBUElcdUZGMDh3aW5kb3cvZG9jdW1lbnRcdUZGMDlcdUZGMUJcdTI0NjEgXHU3NTI4IHN1cHByZXNzSHlkcmF0aW9uV2FybmluZyBcdTYyMTZcdTVCQTJcdTYyMzdcdTdBRUZcdTYyNERcdTZFMzJcdTY3RDNcdTc2ODRcdTdFQzRcdTRFRjZcdTk2OTRcdTc5QkJcdTVERUVcdTVGMDJcdUZGMUJcdTI0NjIgXHU2MzkyXHU2N0U1IGRhdGUvcmFuZG9tL2xvY2FsZSBcdTdCNDlcdTk3NUVcdTc4NkVcdTVCOUFcdTYwMjdcdThGOTNcdTUxRkFcdTMwMDJcIixcbiAgICBza2lsbDogXCJjbmItZG9jc1wiLFxuICAgIG9wZW5Tb3VyY2U6IFwicmVhY3QtZG9tIGh5ZHJhdGlvbiAvIG5leHQuanMgLyBudXh0XCIsXG4gICAgdHJpZ2dlckFmdGVyOiAyLFxuICAgIGtleXdvcmRzOiBbXCJoeWRyYXRpb25cIiwgXCJcdTZDMzRcdTU0MDhcIiwgXCJkaWQgbm90IG1hdGNoXCJdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwibG9naW4tYXV0aC1yZWRpcmVjdFwiLFxuICAgIGZpbmdlcnByaW50OiBcImF1dGg6cmVkaXJlY3RcIixcbiAgICB0aXRsZTogXCJcdTc2N0JcdTVGNTUvXHU5Mjc0XHU2NzQzXHU4REYzXHU4RjZDXHU1QkZDXHU4MUY0XHU3NkVFXHU2ODA3XHU5ODc1XHU0RTBEXHU1M0VGXHU4RkJFXCIsXG4gICAgcGF0dGVybjogLyg/Olx1NzY3Qlx1NUY1NXxyZWRpcmVjdHxcdTkxQ0RcdTVCOUFcdTU0MTF8NDAxfDQwM3xcdTk3MDBcdTg5ODFcdTc2N0JcdTVGNTV8XHU2NzJBXHU2Mzg4XHU2NzQzKS9pLFxuICAgIGxldmVsOiBcImd1aWRlXCIsXG4gICAgc29sdXRpb246XG4gICAgICBcIlx1NzY3Qlx1NUY1NVx1NjAwMS9cdTkyNzRcdTY3NDNcdTYyRTZcdTYyMkFcdTY2MkZcdTlBRDhcdTk4OTFcdTUzOUZcdTU2RTBcdUZGMUFcdTc2RUVcdTY4MDdcdTk4NzVcdTVFMzhcdTg4QUJcdTkxQ0RcdTVCOUFcdTU0MTFcdTUyMzBcdTc2N0JcdTVGNTVcdTk4NzVcdTMwMDJcdTYzQThcdTgzNTBcdTYwMURcdThERUZcdUZGMUFcdTI0NjAgXHU3NTI4XHU5ODc5XHU3NkVFXHU3N0U1XHU4QkM2XHU1RTkzXHVGRjA4YnVpbGRLbm93bGVkZ2VDb250ZXh0XHVGRjA5XHU2Q0U4XHU1MTY1XHU2RDRCXHU4QkQ1XHU4RDI2XHU1M0Y3L1x1NTE4NVx1N0Y1MVx1NTdERlx1NTQwRFx1N0VBNlx1NUI5QVx1RkYxQlx1MjQ2MSBcdTUxNDhcdThENzBcdTc2N0JcdTVGNTVcdTZENDFcdTdBMEJcdTUxOERcdTVCRkNcdTgyMkFcdTc2RUVcdTY4MDdcdTk4NzVcdUZGMUJcdTI0NjIgXHU2OEMwXHU2N0U1XHU2NjJGXHU1NDI2XHU1NkUwIENvb2tpZS90b2tlbiBcdTdGM0FcdTU5MzFcdTg4QUIgNDAxLzQwMyBcdTYyRTZcdTYyMkFcdTMwMDJcIixcbiAgICBza2lsbDogXCJjbmItcmVwby1rbm93bGVkZ2UtYmFzZVwiLFxuICAgIG9wZW5Tb3VyY2U6IFwicGxheXdyaWdodCBzdG9yYWdlU3RhdGUgLyBhdXRoIGZpeHR1cmVcIixcbiAgICB0cmlnZ2VyQWZ0ZXI6IDIsXG4gICAga2V5d29yZHM6IFtcIlx1NzY3Qlx1NUY1NVwiLCBcIlx1OTI3NFx1Njc0M1wiLCBcIjQwMVwiLCBcIjQwM1wiLCBcIlx1OTFDRFx1NUI5QVx1NTQxMVwiXSxcbiAgfSxcbiAge1xuICAgIGlkOiBcImJsYW5rLXdoaXRlLXBhZ2VcIixcbiAgICBmaW5nZXJwcmludDogXCJkb206YmxhbmstcGFnZVwiLFxuICAgIHRpdGxlOiBcIlx1OTg3NVx1OTc2Mlx1N0E3QVx1NzY3RC9cdTY3MkFcdTZFMzJcdTY3RDNcIixcbiAgICBwYXR0ZXJuOiAvKD86XHU3QTdBXHU3NjdEfFx1NzY3RFx1NUM0RnxibGFua3xub3RoaW5nfFx1N0E3QVx1OTg3NVx1OTc2MnxcdTY3MkFcdTZFMzJcdTY3RDMpL2ksXG4gICAgbGV2ZWw6IFwiYXV0b1wiLFxuICAgIHNvbHV0aW9uOlxuICAgICAgXCJcdTY4MDdcdTUxQzZcdTUzMTZcdTYzOTJcdTY3RTVcdTc2N0RcdTVDNEZcdUZGMUFcdTI0NjAgXHU3NzBCXHU2M0E3XHU1MjM2XHU1M0YwXHU2NjJGXHU1NDI2IEpTIFx1NjJBNVx1OTUxOVx1NUJGQ1x1ODFGNFx1NjU3NFx1NjgxMVx1NjcyQVx1NkUzMlx1NjdEM1x1RkYwOFx1NUUzOFx1ODlDMVx1NEU4RVx1NjcyQSBjYXRjaCBcdTc2ODRcdTUyMURcdTU5Q0JcdTUzMTZcdTVGMDJcdTVFMzhcdUZGMDlcdUZGMUJcdTI0NjEgXHU2OEMwXHU2N0U1XHU4RDQ0XHU2RTkwXHU2NjJGXHU1NDI2XHU4OEFCXHU2MkU2XHU2MjJBXHVGRjA4Q1NQL1x1NTJBMFx1OEY3RFx1NTkzMVx1OEQyNVx1RkYwOVx1RkYxQlx1MjQ2MiBcdTc4NkVcdThCQTRcdTYzMDJcdThGN0RcdTgyODJcdTcwQjlcdTY2MkZcdTU0MjZcdTVCNThcdTU3MjhcdTMwMDFcdTY4NDZcdTY3QjZcdTY2MkZcdTU0MjZcdTZCNjNcdTVFMzggYm9vdHN0cmFwXHUzMDAyXCIsXG4gICAgdHJpZ2dlckFmdGVyOiAyLFxuICAgIGtleXdvcmRzOiBbXCJcdTc2N0RcdTVDNEZcIiwgXCJcdTdBN0FcdTc2N0RcIiwgXCJibGFua1wiXSxcbiAgfSxcbl07XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogXHU5NTE5XHU4QkVGXHU2MzA3XHU3RUI5XHVGRjA4ZmluZ2VycHJpbnRcdUZGMDlcdTVGNTJcdTRFMDBcdTUzMTZcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLyoqXG4gKiBcdTRFQ0VcdTk1MTlcdThCRUZcdTY1ODdcdTY3MkMgLyBcdThCQ0FcdTY1QURcdTY0NThcdTg5ODFcdTVGNTJcdTRFMDBcdTUzMTZcdTRFM0FcdTdBMzNcdTVCOUFcdTc2ODRcdTk1MTlcdThCRUZcdTYzMDdcdTdFQjlcdTMwMDJcbiAqIFx1NjMwN1x1N0VCOVx1NzUyOFx1NEU4RVx1MzAwQ1x1NTQwQ1x1N0M3Qlx1OTUxOVx1OEJFRlx1OEJDNlx1NTIyQlx1MzAwRFx1NTQ4Q1x1MzAwQ1x1NEU4Q1x1NkIyMVx1ODlFNlx1NTNEMVx1NTNCQlx1OTFDRFx1MzAwRFx1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZ2VycHJpbnRFcnJvcih0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIXRleHQpIHJldHVybiBcInVua25vd25cIjtcbiAgY29uc3QgdCA9IHRleHQudG9Mb3dlckNhc2UoKTtcbiAgLy8gXHU3RjUxXHU3RURDXHU5NTE5XHU4QkVGXHVGRjA4XHU1MTQ4XHU1MjI0IENPUlMvXHU4REU4XHU1N0RGXHVGRjBDXHU1MThEXHU1MjI0IEhUVFAgXHU5NTE5XHU4QkVGXHVGRjFCXHU2Q0U4XHU2MTBGXHU2MjhBIFRURkIvXHU2MTYyXHU4QkY3XHU2QzQyXHU2M0QwXHU1MjREXHVGRjBDXHU5MDdGXHU1MTREIFwiMTUwMG1zXCIgXHU5MUNDXHU3Njg0IDUwMCBcdThCRUZcdTUyMjRcdTRFM0EgSFRUUCBcdTk1MTlcdThCRUZcdUZGMDlcbiAgaWYgKC9jb3JzfGFjY2Vzcy1jb250cm9sfFx1OERFOFx1NTdERi8udGVzdCh0KSkgcmV0dXJuIFwibmV0d29yazpjb3JzXCI7XG4gIC8vIFx1NjAyN1x1ODBGRFx1RkYxQVRURkIgLyBcdTYxNjJcdThCRjdcdTZDNDJcdUZGMDhcdTRGMThcdTUxNDhcdTRFOEUgSFRUUCBcdTk1MTlcdThCRUZcdTUyMjRcdTVCOUFcdUZGMENcdTU2RTBcdTRFM0FcdTY1NzBcdTUwM0NcdTkxQ0NcdTUzRUZcdTgwRkRcdTU0MkIgNTAwLzQwNCBcdTY1NzBcdTVCNTdcdUZGMDlcbiAgaWYgKC90dGZifFx1NjE2Mlx1OEJGN1x1NkM0Mi8udGVzdCh0KSkgcmV0dXJuIFwicGVyZm9ybWFuY2U6dHRmYlwiO1xuICAvLyBcdTdGNTFcdTdFREMgSFRUUCBcdTk1MTlcdThCRUZcdUZGMDhcdTRFQzVcdTVGNTNcdTY2MEVcdTc4NkVcdTUxRkFcdTczQjBcdTU5MzFcdThEMjVcdThCRURcdTRFNDlcdTYyMTZcdTcyQjZcdTYwMDFcdTc4MDFcdUZGMENcdTkwN0ZcdTUxNERcdThCRUZcdTUyMjRcdTY1NzBcdTUwM0NcdUZGMDlcbiAgaWYgKC9cdTU5MzFcdThEMjVcdThCRjdcdTZDNDJ8XHU4QkY3XHU2QzQyXHU1OTMxXHU4RDI1fHJlcXVlc3QgZmFpbGVkfHN0YXR1c1xccypbOlxcc10qKD86NDA0fDUwMCkvLnRlc3QodCkpIHJldHVybiBcIm5ldHdvcms6aHR0cC1lcnJvclwiO1xuICBpZiAoL1xcYig/OjQwNHw1MDApXFxiLy50ZXN0KHQpICYmICEvXFxkezQsfS8udGVzdCh0KSkgcmV0dXJuIFwibmV0d29yazpodHRwLWVycm9yXCI7XG4gIC8vIEpTIFx1NUYwMlx1NUUzOFxuICBpZiAoL3VuY2F1Z2h0fFx1NjcyQVx1NjM1NVx1ODNCN3x0eXBlZXJyb3J8cmVmZXJlbmNlZXJyb3J8anMgXHU1RjAyXHU1RTM4Ly50ZXN0KHQpKSByZXR1cm4gXCJjb25zb2xlOmpzLWV4Y2VwdGlvblwiO1xuICAvLyBET00gXHU1QjlBXHU0RjREXG4gIGlmICgvXHU2NzJBXHU2MjdFXHU1MjMwfFx1NjVFMFx1NkNENVx1NUI5QVx1NEY0RHxcdTVCOUFcdTRGNERcdTU5MzFcdThEMjV8XHU1QjlBXHU0RjRELipcdTU5MzFcdThEMjV8ZWxlbWVudCBub3QgZm91bmR8bm8gZWxlbWVudHxub3QgZm91bmR8XHU2MjdFXHU0RTBEXHU1MjMwLy50ZXN0KHQpKSByZXR1cm4gXCJkb206bG9jYXRvci1mYWlsZWRcIjtcbiAgLy8gXHU5Mjc0XHU2NzQzXG4gIGlmICgvNDAxfDQwM3xcdTc2N0JcdTVGNTV8XHU5Mjc0XHU2NzQzfFx1NjcyQVx1NjM4OFx1Njc0M3xyZWRpcmVjdHxcdTkxQ0RcdTVCOUFcdTU0MTEvLnRlc3QodCkpIHJldHVybiBcImF1dGg6cmVkaXJlY3RcIjtcbiAgLy8gXHU2QzM0XHU1NDA4XG4gIGlmICgvaHlkcmF0aW9ufFx1NkMzNFx1NTQwOHxkaWQgbm90IG1hdGNoLy50ZXN0KHQpKSByZXR1cm4gXCJkb206aHlkcmF0aW9uLW1pc21hdGNoXCI7XG4gIC8vIFx1NzY3RFx1NUM0RlxuICBpZiAoL1x1NzY3RFx1NUM0RnxcdTdBN0FcdTc2N0R8Ymxhbmt8XHU2NzJBXHU2RTMyXHU2N0QzLy50ZXN0KHQpKSByZXR1cm4gXCJkb206YmxhbmstcGFnZVwiO1xuICAvLyBcdTkwMUFcdTc1MjhcdTU5MzFcdThEMjVcdUZGMDhcdTUxNUNcdTVFOTVcdUZGMENcdTk2NERcdTRGNEVcdThCRUZcdTYyQTVcdUZGMUFcdThGRDlcdTdDN0JcdTRFMERcdTVGM0FcdTg5RTZcdTUzRDFcdUZGMDlcbiAgcmV0dXJuIFwiZ2VuZXJpYzphY3Rpb24tZmFpbGVkXCI7XG59XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogXHU5MUNEXHU1OTBEXHU5NTE5XHU4QkVGXHU2Q0U4XHU1MThDXHU4ODY4XHVGRjA4XHU0RThDXHU2QjIxXHU4OUU2XHU1M0QxXHVGRjA5XG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbi8qKlxuICogXHU5MUNEXHU1OTBEXHU5NTE5XHU4QkVGXHU2Q0U4XHU1MThDXHU4ODY4XHVGRjFBXHU4QkIwXHU1RjU1XHU2QkNGXHU0RTJBXHU5NTE5XHU4QkVGXHU2MzA3XHU3RUI5XHU3Njg0XHU1MUZBXHU3M0IwXHU2QjIxXHU2NTcwXHUzMDAyXG4gKiBcdTUzRUFcdTY3MDlcdTVGNTNcdTY3RDBcdTYzMDdcdTdFQjlcdTUxRkFcdTczQjBcdTZCMjFcdTY1NzBcdThGQkVcdTUyMzAgYHRyaWdnZXJBZnRlcmBcdUZGMDhcdTlFRDhcdThCQTQgMlx1RkYwOVx1NjVGNlx1NjI0RFx1ODlFNlx1NTNEMVx1ODlFM1x1NTFCM1x1NjVCOVx1Njg0OFx1NjNBOFx1ODM1MFx1RkYwQ1xuICogXHU1QjlFXHU3M0IwXHUzMDBDXHU0RTBEXHU1OTFBXHU0RjU5XHVGRjBDXHU0RTVGXHU0RTBEXHU1NkYwXHU1ODgzXHUzMDBEXHUyMDE0XHUyMDE0XHU3QjJDIDEgXHU2QjIxXHU5NzU5XHU5RUQ4XHVGRjBDXHU3QjJDIDIgXHU2QjIxXHU2MjREXHU3RUQ5XHU1MUZBXHU2NzA5XHU0RUY3XHU1MDNDXHU3Njg0XHU2NUI5XHU2ODQ4XHUzMDAyXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXBlYXRFcnJvclJlZ2lzdHJ5IHtcbiAgcHJpdmF0ZSBjb3VudHMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAvKiogXHU4MUVBXHU1QjlBXHU0RTQ5XHU4OUU2XHU1M0QxXHU5NjA4XHU1MDNDXHVGRjA4XHU5RUQ4XHU4QkE0IDJcdUZGMDkgKi9cbiAgcHJpdmF0ZSB0aHJlc2hvbGQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3Rvcih0aHJlc2hvbGQgPSAyKSB7XG4gICAgdGhpcy50aHJlc2hvbGQgPSB0aHJlc2hvbGQ7XG4gIH1cblxuICAvKiogXHU4QkIwXHU1RjU1XHU0RTAwXHU2QjIxXHU5NTE5XHU4QkVGXHVGRjBDXHU4RkQ0XHU1NkRFXHU2NjJGXHU1NDI2XHU4RkJFXHU1MjMwXHU4OUU2XHU1M0QxXHU5NjA4XHU1MDNDICovXG4gIHJlY29yZCh0ZXh0OiBzdHJpbmcpOiB7IGZpbmdlcnByaW50OiBzdHJpbmc7IG9jY3VycmVuY2VzOiBudW1iZXI7IHRyaWdnZXJlZDogYm9vbGVhbiB9IHtcbiAgICBjb25zdCBmcCA9IGZpbmdlcnByaW50RXJyb3IodGV4dCk7XG4gICAgY29uc3Qgb2NjdXJyZW5jZXMgPSAodGhpcy5jb3VudHMuZ2V0KGZwKSA/PyAwKSArIDE7XG4gICAgdGhpcy5jb3VudHMuc2V0KGZwLCBvY2N1cnJlbmNlcyk7XG4gICAgcmV0dXJuIHsgZmluZ2VycHJpbnQ6IGZwLCBvY2N1cnJlbmNlcywgdHJpZ2dlcmVkOiBvY2N1cnJlbmNlcyA+PSB0aGlzLnRocmVzaG9sZCB9O1xuICB9XG5cbiAgLyoqIFx1NjdFNVx1OEJFMlx1NjdEMFx1NjMwN1x1N0VCOVx1NUY1M1x1NTI0RFx1NkIyMVx1NjU3MFx1RkYwOFx1NEUwRFx1NjUzOVx1NTNEOFx1OEJBMVx1NjU3MFx1RkYwOSAqL1xuICBwZWVrKHRleHQ6IHN0cmluZyk6IHsgZmluZ2VycHJpbnQ6IHN0cmluZzsgb2NjdXJyZW5jZXM6IG51bWJlciB9IHtcbiAgICBjb25zdCBmcCA9IGZpbmdlcnByaW50RXJyb3IodGV4dCk7XG4gICAgcmV0dXJuIHsgZmluZ2VycHJpbnQ6IGZwLCBvY2N1cnJlbmNlczogdGhpcy5jb3VudHMuZ2V0KGZwKSA/PyAwIH07XG4gIH1cblxuICAvKiogXHU5MUNEXHU3RjZFXHVGRjA4XHU2NUIwXHU0RTAwXHU4RjZFXHU4QzAzXHU4QkQ1XHU1RjAwXHU1OUNCXHU2NUY2XHU1M0VGXHU4QzAzXHU3NTI4XHVGRjA5ICovXG4gIHJlc2V0KCk6IHZvaWQge1xuICAgIHRoaXMuY291bnRzLmNsZWFyKCk7XG4gIH1cbn1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTUzMzlcdTkxNERcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLyoqXG4gKiBcdTU3MjggcGxheWJvb2sgXHU0RTJEXHU2N0U1XHU2MjdFXHU0RTBFXHU5NTE5XHU4QkVGXHU2NTg3XHU2NzJDXHU1MzM5XHU5MTREXHU3Njg0XHU2NUI5XHU2ODQ4XHU2NzYxXHU3NkVFXHUzMDAyXG4gKiBcdTRGMThcdTUxNDhcdTdDQkVcdTc4NkVcdTUzMzlcdTkxNEQgZmluZ2VycHJpbnRcdUZGMENcdTUxNzZcdTZCMjFcdTc1MjggcGF0dGVybi9rZXl3b3JkcyBcdTUxNUNcdTVFOTVcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cFNvbHV0aW9uKHRleHQ6IHN0cmluZywgZmluZ2VycHJpbnQ/OiBzdHJpbmcpOiBTb2x1dGlvbkVudHJ5IHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgZnAgPSBmaW5nZXJwcmludCA/PyBmaW5nZXJwcmludEVycm9yKHRleHQpO1xuICBjb25zdCB0ID0gdGV4dC50b0xvd2VyQ2FzZSgpO1xuXG4gIC8vIDEuIGZpbmdlcnByaW50IFx1N0NCRVx1Nzg2RVx1NTQ3RFx1NEUyRFxuICBjb25zdCBieUZwID0gU09MVVRJT05fUExBWUJPT0suZmluZCgocykgPT4gcy5maW5nZXJwcmludCA9PT0gZnApO1xuICBpZiAoYnlGcCkgcmV0dXJuIGJ5RnA7XG5cbiAgLy8gMi4gXHU2QjYzXHU1MjE5IHBhdHRlcm4gXHU1NDdEXHU0RTJEXG4gIGNvbnN0IGJ5UGF0dGVybiA9IFNPTFVUSU9OX1BMQVlCT09LLmZpbmQoKHMpID0+IHMucGF0dGVybi50ZXN0KHRleHQpKTtcbiAgaWYgKGJ5UGF0dGVybikgcmV0dXJuIGJ5UGF0dGVybjtcblxuICAvLyAzLiBcdTUxNzNcdTk1MkVcdThCQ0RcdTUxNUNcdTVFOTVcbiAgY29uc3QgYnlLZXl3b3JkID0gU09MVVRJT05fUExBWUJPT0suZmluZChcbiAgICAocykgPT4gcy5rZXl3b3JkcyAmJiBzLmtleXdvcmRzLnNvbWUoKGspID0+IHQuaW5jbHVkZXMoay50b0xvd2VyQ2FzZSgpKSlcbiAgKTtcbiAgcmV0dXJuIGJ5S2V5d29yZDtcbn1cblxuLyoqXG4gKiBcdTY4MzhcdTVGQzNcdTUzMzlcdTkxNERcdTUxNjVcdTUzRTNcdUZGMUFcbiAqIFx1N0VEOVx1NUI5QVx1NEUwMFx1NkIyMVx1OTUxOVx1OEJFRlx1NjU4N1x1NjcyQ1x1RkYwQ1x1N0VEM1x1NTQwOFx1OTFDRFx1NTkwRFx1NkNFOFx1NTE4Q1x1ODg2OFx1NTA1QVx1MzAwQ1x1NEU4Q1x1NkIyMVx1ODlFNlx1NTNEMVx1MzAwRFx1NTIyNFx1NUI5QVx1RkYwQ1xuICogXHU1NDdEXHU0RTJEXHU1MjE5XHU4RkQ0XHU1NkRFXHU4OUUzXHU1MUIzXHU2NUI5XHU2ODQ4XHVGRjA4XHU1NDJCIGF1dG8vZ3VpZGUgXHU1MjA2XHU3RUE3XHU0RTBFXHU1M0VGXHU2MjY3XHU4ODRDXHU1RUZBXHU4QkFFXHVGRjA5XHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaFNvbHV0aW9uKHJlZ2lzdHJ5OiBSZXBlYXRFcnJvclJlZ2lzdHJ5LCBlcnJvclRleHQ6IHN0cmluZyk6IFNvbHV0aW9uTWF0Y2gge1xuICBjb25zdCB7IGZpbmdlcnByaW50LCBvY2N1cnJlbmNlcywgdHJpZ2dlcmVkIH0gPSByZWdpc3RyeS5yZWNvcmQoZXJyb3JUZXh0KTtcbiAgaWYgKCF0cmlnZ2VyZWQpIHtcbiAgICByZXR1cm4geyB0cmlnZ2VyZWQ6IGZhbHNlLCBmaW5nZXJwcmludCwgb2NjdXJyZW5jZXMgfTtcbiAgfVxuICBjb25zdCBlbnRyeSA9IGxvb2t1cFNvbHV0aW9uKGVycm9yVGV4dCwgZmluZ2VycHJpbnQpO1xuICBpZiAoIWVudHJ5KSB7XG4gICAgcmV0dXJuIHsgdHJpZ2dlcmVkOiB0cnVlLCBmaW5nZXJwcmludCwgb2NjdXJyZW5jZXMgfTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHRyaWdnZXJlZDogdHJ1ZSxcbiAgICBmaW5nZXJwcmludCxcbiAgICBvY2N1cnJlbmNlcyxcbiAgICBlbnRyeSxcbiAgICBhZHZpY2U6IHJlbmRlckFkdmljZShlbnRyeSksXG4gIH07XG59XG5cbi8qKiBcdTZFMzJcdTY3RDNcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTY1ODdcdTY3MkMgKi9cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJBZHZpY2UoZW50cnk6IFNvbHV0aW9uRW50cnkpOiBzdHJpbmcge1xuICBjb25zdCBoZWFkID0gYFtcdTVERjJcdTdCMkMgMiBcdTZCMjFcdTkwNDdcdTUyMzBcdTU0MENcdTdDN0JcdTk1RUVcdTk4OThcdUZGNUNcdTY1QjlcdTY4NDhcdTYzQThcdTgzNTBdICR7ZW50cnkudGl0bGV9XHVGRjA4XHU3RUE3XHU1MjJCOiAke2VudHJ5LmxldmVsID09PSBcImF1dG9cIiA/IFwiXHU4MUVBXHU1MkE4XHU0RkVFXHU1OTBEXCIgOiBcIlx1NjAxRFx1OERFRlx1NUYxNVx1NUJGQ1wifVx1RkYwOWA7XG4gIGNvbnN0IGxpbmVzID0gW2hlYWQsIGA+ICR7ZW50cnkuc29sdXRpb259YF07XG4gIGlmIChlbnRyeS5sZXZlbCA9PT0gXCJndWlkZVwiKSB7XG4gICAgaWYgKGVudHJ5LnNraWxsKSBsaW5lcy5wdXNoKGA+IFx1NjNBOFx1ODM1MCBza2lsbFx1RkYxQSR7ZW50cnkuc2tpbGx9YCk7XG4gICAgaWYgKGVudHJ5Lm9wZW5Tb3VyY2UpIGxpbmVzLnB1c2goYD4gXHU2M0E4XHU4MzUwXHU2NUI5XHU2ODQ4L1x1NUYwMFx1NkU5MFx1OTg3OVx1NzZFRVx1RkYxQSR7ZW50cnkub3BlblNvdXJjZX1gKTtcbiAgICBsaW5lcy5wdXNoKFwiPiBcdTYwMURcdThERUZcdUZGMUFcdTUxNDhcdTVCOUFcdTRGNERcdTY4MzlcdTU2RTBcdUZGMENcdTUxOERcdTYzMDlcdTRFMEFcdThGRjBcdTk4NzlcdTc2RUUvXHU2MjgwXHU4MEZEXHU4NDNEXHU1NzMwXHVGRjBDXHU1M0VGXHU2NjNFXHU4NDU3XHU1MUNGXHU1QzExXHU5MUNEXHU1OTBEXHU5MDIwXHU4RjZFXHU1QjUwXHUzMDAyXCIpO1xuICB9XG4gIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG4vKiogXHU5RUQ4XHU4QkE0XHU2Q0U4XHU1MThDXHU4ODY4XHU1QjlFXHU0RjhCXHVGRjA4XHU0RjlCXHU2NUUwXHU3MkI2XHU2MDAxXHU4QzAzXHU3NTI4XHU1OTBEXHU3NTI4XHVGRjBDXHU1M0VGXHU2MzA5XHU0RjFBXHU4QkREIHJlc2V0XHVGRjA5ICovXG5leHBvcnQgY29uc3QgZGVmYXVsdFJlZ2lzdHJ5ID0gbmV3IFJlcGVhdEVycm9yUmVnaXN0cnkoKTtcblxuLyoqXG4gKiBcdTRGQkZcdTYzNzdcdTUxRkRcdTY1NzBcdUZGMUFcdTYyOEFcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTZDRThcdTUxNjVcdTUyMzBcdTRFMDBcdTY3NjFcdThDMDNcdThCRDVcdTRFMEFcdTRFMEJcdTY1ODdcdTkxQ0NcdTMwMDJcbiAqIFx1ODJFNVx1NURGMlx1ODlFNlx1NTNEMVx1RkYwOFx1N0IyQyAyIFx1NkIyMVx1NTQwQ1x1N0M3Qlx1OTUxOVx1OEJFRlx1RkYwOVx1RkYwQ1x1OEZENFx1NTZERVx1OTY0NFx1NUUyNlx1NjVCOVx1Njg0OFx1NzY4NFx1NEUwQVx1NEUwQlx1NjU4N1x1RkYxQlx1NTQyNlx1NTIxOVx1OEZENFx1NTZERVx1NTM5Rlx1NjU4N1x1NjcyQ1x1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXVnbWVudFdpdGhTb2x1dGlvbihyZWdpc3RyeTogUmVwZWF0RXJyb3JSZWdpc3RyeSwgY29udGV4dFRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IG1hdGNoID0gbWF0Y2hTb2x1dGlvbihyZWdpc3RyeSwgY29udGV4dFRleHQpO1xuICBpZiAobWF0Y2gudHJpZ2dlcmVkICYmIG1hdGNoLmFkdmljZSkge1xuICAgIHJldHVybiBgJHtjb250ZXh0VGV4dH1cXG5cXG4tLS1cXG4ke21hdGNoLmFkdmljZX1gO1xuICB9XG4gIHJldHVybiBjb250ZXh0VGV4dDtcbn1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBcdTUzRUZcdTYyMTBcdTk1N0ZcdTc2ODRcdTU3MjhcdTdFQkZcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTVFOTNcdUZGMDhTb2x1dGlvbiBSZXBvc2l0b3J5XHVGRjA5XG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbi8qKlxuICogXHU2MzAxXHU0RTQ1XHU1MzE2XHU2NUI5XHU2ODQ4XHU1RTkzXHU2NTg3XHU0RUY2XHU2ODNDXHU1RjBGXHVGRjA4SlNPTlx1RkYwOVx1MzAwMlxuICogcGF0dGVybiBcdTVCNTdcdTZCQjVcdTU3MjhcdTc4QzFcdTc2RDhcdTRFMEFcdTVCNThcdTRFM0FcdTVCNTdcdTdCMjZcdTRFMzJcdUZGMENcdTUyQTBcdThGN0RcdTY1RjYgbmV3IFJlZ0V4cCBcdThGRDhcdTUzOUZcdTMwMDJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTb2x1dGlvblJlcG9GaWxlIHtcbiAgLyoqIFx1NjVCOVx1Njg0OFx1Njc2MVx1NzZFRVx1RkYwOFx1NEUwRFx1NTQyQiBwYXR0ZXJuIFx1NjVFMFx1NkNENSBKU09OIFx1NUU4Rlx1NTIxN1x1NTMxNlx1NzY4NFx1OTBFOFx1NTIwNlx1RkYwQ1x1NzUyOCBwYXR0ZXJuU291cmNlIFx1NUI1N1x1N0IyNlx1NEUzMlx1NUI1OFx1NTBBOFx1RkYwOSAqL1xuICBlbnRyaWVzOiBQZXJzaXN0ZWRTb2x1dGlvbltdO1xuICAvKiogXHU1QzFBXHU2NzJBXHU4OUUzXHU1MUIzXHU3Njg0XHU2NUIwXHU5NTE5XHU4QkVGXHU2MzA3XHU3RUI5XHU1MDE5XHU5MDA5XHVGRjA4XHU0RjlCXHU1NDBFXHU3RUVEXHU2Qzg5XHU2REMwXHU2NUI5XHU2ODQ4XHVGRjBDXHU5MDdGXHU1MTREXHU5MUNEXHU1OTBEXHU5MDIwXHU4RjZFXHU1QjUwXHVGRjA5ICovXG4gIHVua25vd25FcnJvcnM/OiBzdHJpbmdbXTtcbiAgLyoqIFx1NTE0M1x1NEZFMVx1NjA2RiAqL1xuICBtZXRhPzogeyB1cGRhdGVkQXQ/OiBzdHJpbmc7IHNvdXJjZT86IHN0cmluZyB9O1xufVxuXG4vKiogXHU1M0VGXHU2MzAxXHU0RTQ1XHU1MzE2XHU2NUI5XHU2ODQ4XHU2NzYxXHU3NkVFXHVGRjA4cGF0dGVybiBcdThGNkNcdTRFM0FcdTVCNTdcdTdCMjZcdTRFMzJcdUZGMDkgKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGVyc2lzdGVkU29sdXRpb24ge1xuICBpZDogc3RyaW5nO1xuICBmaW5nZXJwcmludDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICAvKiogXHU2QjYzXHU1MjE5XHU2RTkwXHVGRjA4XHU1QjU3XHU3QjI2XHU0RTMyXHVGRjA5ICovXG4gIHBhdHRlcm5Tb3VyY2U6IHN0cmluZztcbiAgbGV2ZWw6IFNvbHV0aW9uTGV2ZWw7XG4gIHNvbHV0aW9uOiBzdHJpbmc7XG4gIHNraWxsPzogc3RyaW5nO1xuICBvcGVuU291cmNlPzogc3RyaW5nO1xuICB0cmlnZ2VyQWZ0ZXI/OiBudW1iZXI7XG4gIGtleXdvcmRzPzogc3RyaW5nW107XG4gIC8qKiBcdTY1QjlcdTY4NDhcdTY3NjVcdTZFOTBcdTY4MDdcdTZDRTggKi9cbiAgc291cmNlPzogc3RyaW5nO1xufVxuXG4vKiogXHU2MjhBXHU1MTg1XHU3RjZFIFNvbHV0aW9uRW50cnkgXHU4RjZDXHU0RTNBXHU1M0VGXHU2MzAxXHU0RTQ1XHU1MzE2XHU1RjYyXHU1RjBGICovXG5leHBvcnQgZnVuY3Rpb24gdG9QZXJzaXN0ZWQoZW50cnk6IFNvbHV0aW9uRW50cnkpOiBQZXJzaXN0ZWRTb2x1dGlvbiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGVudHJ5LmlkLFxuICAgIGZpbmdlcnByaW50OiBlbnRyeS5maW5nZXJwcmludCxcbiAgICB0aXRsZTogZW50cnkudGl0bGUsXG4gICAgcGF0dGVyblNvdXJjZTogZW50cnkucGF0dGVybi5zb3VyY2UsXG4gICAgbGV2ZWw6IGVudHJ5LmxldmVsLFxuICAgIHNvbHV0aW9uOiBlbnRyeS5zb2x1dGlvbixcbiAgICBza2lsbDogZW50cnkuc2tpbGwsXG4gICAgb3BlblNvdXJjZTogZW50cnkub3BlblNvdXJjZSxcbiAgICB0cmlnZ2VyQWZ0ZXI6IGVudHJ5LnRyaWdnZXJBZnRlcixcbiAgICBrZXl3b3JkczogZW50cnkua2V5d29yZHMsXG4gICAgc291cmNlOiBlbnRyeS5zb3VyY2UsXG4gIH07XG59XG5cbi8qKiBcdTYyOEFcdTYzMDFcdTRFNDVcdTUzMTZcdTVGNjJcdTVGMEZcdThGRDhcdTUzOUZcdTRFM0FcdThGRDBcdTg4NENcdTY1RjYgU29sdXRpb25FbnRyeSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21QZXJzaXN0ZWQocDogUGVyc2lzdGVkU29sdXRpb24pOiBTb2x1dGlvbkVudHJ5IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogcC5pZCxcbiAgICBmaW5nZXJwcmludDogcC5maW5nZXJwcmludCxcbiAgICB0aXRsZTogcC50aXRsZSxcbiAgICBwYXR0ZXJuOiBuZXcgUmVnRXhwKHAucGF0dGVyblNvdXJjZSwgXCJpXCIpLFxuICAgIGxldmVsOiBwLmxldmVsLFxuICAgIHNvbHV0aW9uOiBwLnNvbHV0aW9uLFxuICAgIHNraWxsOiBwLnNraWxsLFxuICAgIG9wZW5Tb3VyY2U6IHAub3BlblNvdXJjZSxcbiAgICB0cmlnZ2VyQWZ0ZXI6IHAudHJpZ2dlckFmdGVyLFxuICAgIGtleXdvcmRzOiBwLmtleXdvcmRzLFxuICAgIHNvdXJjZTogcC5zb3VyY2UsXG4gIH07XG59XG5cbi8qKlxuICogXHU1M0VGXHU2MjEwXHU5NTdGXHU3Njg0XHU4OUUzXHU1MUIzXHU2NUI5XHU2ODQ4XHU0RUQzXHU1RTkzXHVGRjFBXHU1MTg1XHU3RjZFIHBsYXlib29rICsgXHU3NTI4XHU2MjM3XHU2Qzg5XHU2REMwXHU3Njg0XHU2MzAxXHU0RTQ1XHU1MzE2XHU2NUI5XHU2ODQ4XHU1RTkzXHU1NDA4XHU1RTc2XHU2N0U1XHU4QkUyXHUzMDAyXG4gKlxuICogXHU4RkQ5XHU2NjJGXHUzMDBDXHU0RTBEXHU0RjlEXHU4RDU2XHU2OEMwXHU3RDIyXHUzMDAxXHU1M0VGXHU2MzAxXHU3RUVEXHU2MjEwXHU5NTdGXHUzMDBEXHU3Njg0XHU1MTczXHU5NTJFXHVGRjFBXG4gKiAtIFx1NkJDRlx1NkIyMVx1ODlFM1x1NTFCM1x1NEUwMFx1NEUyQVx1NjVCMFx1OTVFRVx1OTg5OFx1RkYwQ1x1OEMwM1x1NzUyOCBgYWRkU29sdXRpb25gIFx1NkM4OVx1NkRDMFx1OEZEQlx1NUU5M1x1NjU4N1x1NEVGNlx1RkYwOFx1NEY1Q1x1NEUzQVx1MzAwQ1x1NTcyOFx1N0VCRlx1NUU5M1x1MzAwRFx1NTE3MVx1NEVBQlx1RkYwOVx1RkYxQlxuICogLSBcdTkwNDdcdTUyMzBcdTY3MkFcdTU0N0RcdTRFMkRcdTc2ODRcdTY1QjBcdTk1MTlcdThCRUZcdUZGMENcdThCQjBcdTVGNTVcdTUyMzAgYHVua25vd25FcnJvcnNgXHVGRjBDXHU0RjlCXHU1NDBFXHU3RUVEXHU4ODY1XHU1MTQ1XHU2NUI5XHU2ODQ4XHVGRjFCXG4gKiAtIFx1NjVCOVx1Njg0OFx1NUU5M1x1NjU4N1x1NEVGNlx1NTNFRlx1NjNEMFx1NEVBNFx1OEZEQlx1NEVEM1x1NUU5MyAvIFx1NEY1Q1x1NEUzQSBDSSBcdTUyMzZcdTU0QzFcdTVCRkNcdTUxRkFcdUZGMENcdTVCOUVcdTczQjBcdTMwMENcdThEOEFcdTc1MjhcdThEOEFcdTU5MjdcdTMwMDFcdTRFMEFcdTk2NTBcdTYzMDFcdTdFRURcdTYzRDBcdTlBRDhcdTMwMERcdTMwMDJcbiAqL1xuZXhwb3J0IGNsYXNzIFNvbHV0aW9uUmVwb3NpdG9yeSB7XG4gIC8qKiBcdTUxODVcdTdGNkUgcGxheWJvb2tcdUZGMDhcdTUzRUFcdThCRkJcdTU3RkFcdTdFQkZcdUZGMDkgKi9cbiAgcHJpdmF0ZSBidWlsdGluOiBTb2x1dGlvbkVudHJ5W10gPSBTT0xVVElPTl9QTEFZQk9PSztcbiAgLyoqIFx1NzUyOFx1NjIzN1x1NkM4OVx1NkRDMFx1NzY4NFx1NjVCOVx1Njg0OFx1RkYwOFx1NjMwMVx1NEU0NVx1NTMxNlx1RkYwOSAqL1xuICBwcml2YXRlIGN1c3RvbTogU29sdXRpb25FbnRyeVtdID0gW107XG4gIC8qKiBcdTY3MkFcdTU0N0RcdTRFMkRcdTc2ODRcdTY1QjBcdTk1MTlcdThCRUZcdTYzMDdcdTdFQjlcdUZGMDhcdTUwMTlcdTkwMDlcdTZDODlcdTZEQzBcdUZGMDkgKi9cbiAgcHJpdmF0ZSB1bmtub3duID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIC8qKiBcdTVFOTNcdTY1ODdcdTRFRjZcdThERUZcdTVGODQgKi9cbiAgcHJpdmF0ZSBmaWxlUGF0aD86IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihmaWxlUGF0aD86IHN0cmluZykge1xuICAgIHRoaXMuZmlsZVBhdGggPSBmaWxlUGF0aDtcbiAgICBpZiAoZmlsZVBhdGgpIHRoaXMubG9hZChmaWxlUGF0aCk7XG4gIH1cblxuICAvKiogXHU1MTY4XHU5MEU4XHU2NUI5XHU2ODQ4XHVGRjA4XHU1MTg1XHU3RjZFICsgXHU2Qzg5XHU2REMwXHVGRjA5ICovXG4gIGdldCBlbnRyaWVzKCk6IFNvbHV0aW9uRW50cnlbXSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLmJ1aWx0aW4sIC4uLnRoaXMuY3VzdG9tXTtcbiAgfVxuXG4gIC8qKiBcdTRFQzVcdTc1MjhcdTYyMzdcdTZDODlcdTZEQzBcdTc2ODRcdTY1QjlcdTY4NDhcdUZGMDhcdTYyMTBcdTk1N0ZcdTVFOTNcdTY1QjBcdTU4OUVcdTkwRThcdTUyMDZcdUZGMDkgKi9cbiAgZ2V0IGN1c3RvbUVudHJpZXMoKTogU29sdXRpb25FbnRyeVtdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMuY3VzdG9tXTtcbiAgfVxuXG4gIC8qKiBcdTUyQTBcdThGN0RcdTYzMDFcdTRFNDVcdTUzMTZcdTY1QjlcdTY4NDhcdTVFOTNcdTY1ODdcdTRFRjZcdUZGMDhcdTRFMERcdTVCNThcdTU3MjhcdTUyMTlcdTVGRkRcdTc1NjVcdUZGMDkgKi9cbiAgbG9hZChmaWxlUGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhmaWxlUGF0aCkpIHJldHVybjtcbiAgICAgIGNvbnN0IHJhdzogU29sdXRpb25SZXBvRmlsZSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCBcInV0ZjhcIikpO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmF3LmVudHJpZXMpKSB7XG4gICAgICAgIHRoaXMuY3VzdG9tID0gcmF3LmVudHJpZXMubWFwKGZyb21QZXJzaXN0ZWQpO1xuICAgICAgfVxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmF3LnVua25vd25FcnJvcnMpKSB7XG4gICAgICAgIHJhdy51bmtub3duRXJyb3JzLmZvckVhY2goKHUpID0+IHRoaXMudW5rbm93bi5hZGQodSkpO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gXHU1RTkzXHU2NTg3XHU0RUY2XHU2MzVGXHU1NzRGL1x1NEUwRFx1NTNFRlx1OEJGQlx1NjVGNlx1OTc1OVx1OUVEOFx1NUZGRFx1NzU2NVx1RkYwQ1x1NEZERFx1NzU1OVx1NTE4NVx1N0Y2RVx1NTdGQVx1N0VCRlxuICAgICAgdGhpcy5jdXN0b20gPSBbXTtcbiAgICB9XG4gIH1cblxuICAvKiogXHU2MzAxXHU0RTQ1XHU1MzE2XHU1RjUzXHU1MjREXHU1RTkzXHU1MjMwXHU2NTg3XHU0RUY2ICovXG4gIHBlcnNpc3QoZmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHRhcmdldCA9IGZpbGVQYXRoID8/IHRoaXMuZmlsZVBhdGg7XG4gICAgaWYgKCF0YXJnZXQpIHJldHVybiBcIlwiO1xuICAgIGNvbnN0IGRhdGE6IFNvbHV0aW9uUmVwb0ZpbGUgPSB7XG4gICAgICBlbnRyaWVzOiB0aGlzLmN1c3RvbS5tYXAodG9QZXJzaXN0ZWQpLFxuICAgICAgdW5rbm93bkVycm9yczogWy4uLnRoaXMudW5rbm93bl0sXG4gICAgICBtZXRhOiB7IHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLCBzb3VyY2U6IFwib3BlbmxpdWxhblwiIH0sXG4gICAgfTtcbiAgICBmcy5ta2RpclN5bmMocGF0aC5kaXJuYW1lKHRhcmdldCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIGZzLndyaXRlRmlsZVN5bmModGFyZ2V0LCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSwgXCJ1dGY4XCIpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICAvKipcbiAgICogXHU1NzI4XHU2NUI5XHU2ODQ4XHU1RTkzXHVGRjA4XHU1MTg1XHU3RjZFICsgXHU2Qzg5XHU2REMwXHVGRjA5XHU0RTJEXHU2N0U1XHU2MjdFXHU1MzM5XHU5MTREXHU2NzYxXHU3NkVFXHUzMDAyXG4gICAqIFx1NEYxOFx1NTE0OCBmaW5nZXJwcmludFx1RkYwQ1x1NTE4RCBwYXR0ZXJuXHVGRjBDXHU1MThEXHU1MTczXHU5NTJFXHU4QkNEXHUzMDAyXG4gICAqL1xuICBsb29rdXAodGV4dDogc3RyaW5nLCBmaW5nZXJwcmludD86IHN0cmluZyk6IFNvbHV0aW9uRW50cnkgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGZwID0gZmluZ2VycHJpbnQgPz8gZmluZ2VycHJpbnRFcnJvcih0ZXh0KTtcbiAgICBjb25zdCB0ID0gdGV4dC50b0xvd2VyQ2FzZSgpO1xuICAgIC8vIDEuIGZpbmdlcnByaW50IFx1N0NCRVx1Nzg2RVx1NTQ3RFx1NEUyRFx1RkYwOFx1NEYxOFx1NTE0OFx1ODFFQVx1NUI5QVx1NEU0OVx1NkM4OVx1NkRDMFx1RkYwQ1x1NTE3Nlx1NkIyMVx1NTE4NVx1N0Y2RVx1RkYwOVxuICAgIGNvbnN0IGJ5RnAgPSB0aGlzLmN1c3RvbS5maW5kKChzKSA9PiBzLmZpbmdlcnByaW50ID09PSBmcCkgPz8gdGhpcy5idWlsdGluLmZpbmQoKHMpID0+IHMuZmluZ2VycHJpbnQgPT09IGZwKTtcbiAgICBpZiAoYnlGcCkgcmV0dXJuIGJ5RnA7XG4gICAgLy8gMi4gcGF0dGVybiBcdTU0N0RcdTRFMkRcbiAgICBmb3IgKGNvbnN0IHMgb2YgdGhpcy5lbnRyaWVzKSB7XG4gICAgICBpZiAocy5wYXR0ZXJuLnRlc3QodGV4dCkpIHJldHVybiBzO1xuICAgIH1cbiAgICAvLyAzLiBcdTUxNzNcdTk1MkVcdThCQ0RcdTUxNUNcdTVFOTVcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLmZpbmQoKHMpID0+IHMua2V5d29yZHMgJiYgcy5rZXl3b3Jkcy5zb21lKChrKSA9PiB0LmluY2x1ZGVzKGsudG9Mb3dlckNhc2UoKSkpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBcdTY4MzhcdTVGQzNcdTUzMzlcdTkxNERcdTUxNjVcdTUzRTNcdUZGMDhcdTRFOENcdTZCMjFcdTg5RTZcdTUzRDEgKyBcdTVFOTNcdTUzMzlcdTkxNERcdUZGMDlcdTMwMDJcbiAgICogXHU4OUU2XHU1M0QxXHU2NUY2XHU0RjE4XHU1MTQ4XHU3NTI4XHU0RUQzXHU1RTkzXHU1MzM5XHU5MTREXHU2NUI5XHU2ODQ4XHVGRjFCXHU2NzJBXHU1NDdEXHU0RTJEXHU1MjE5XHU4QkIwXHU1RjU1XHU0RTNBXHU2NUIwXHU5NTE5XHU4QkVGXHU1MDE5XHU5MDA5XHUzMDAyXG4gICAqL1xuICBtYXRjaChyZWdpc3RyeTogUmVwZWF0RXJyb3JSZWdpc3RyeSwgZXJyb3JUZXh0OiBzdHJpbmcpOiBTb2x1dGlvbk1hdGNoIHtcbiAgICBjb25zdCB7IGZpbmdlcnByaW50LCBvY2N1cnJlbmNlcywgdHJpZ2dlcmVkIH0gPSByZWdpc3RyeS5yZWNvcmQoZXJyb3JUZXh0KTtcbiAgICBpZiAoIXRyaWdnZXJlZCkge1xuICAgICAgcmV0dXJuIHsgdHJpZ2dlcmVkOiBmYWxzZSwgZmluZ2VycHJpbnQsIG9jY3VycmVuY2VzIH07XG4gICAgfVxuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5sb29rdXAoZXJyb3JUZXh0LCBmaW5nZXJwcmludCk7XG4gICAgaWYgKCFlbnRyeSkge1xuICAgICAgLy8gXHU2NzJBXHU1NDdEXHU0RTJEIFx1MjE5MiBcdThCQjBcdTVGNTVcdTY1QjBcdTk1MTlcdThCRUZcdTUwMTlcdTkwMDlcdUZGMENcdTRGOUJcdTU0MEVcdTdFRURcdTZDODlcdTZEQzBcdUZGMDhcdTYyMTBcdTk1N0ZcdTcwQjlcdUZGMDlcbiAgICAgIHRoaXMudW5rbm93bi5hZGQoZmluZ2VycHJpbnQpO1xuICAgICAgcmV0dXJuIHsgdHJpZ2dlcmVkOiB0cnVlLCBmaW5nZXJwcmludCwgb2NjdXJyZW5jZXMgfTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHRyaWdnZXJlZDogdHJ1ZSxcbiAgICAgIGZpbmdlcnByaW50LFxuICAgICAgb2NjdXJyZW5jZXMsXG4gICAgICBlbnRyeSxcbiAgICAgIGFkdmljZTogcmVuZGVyQWR2aWNlKGVudHJ5KSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFx1NkM4OVx1NkRDMFx1NEUwMFx1Njc2MVx1NjVCMFx1ODlFM1x1NTFCM1x1NjVCOVx1Njg0OFx1NTIzMFx1ODFFQVx1NUI5QVx1NEU0OVx1NUU5M1x1RkYwOFx1NTNCQlx1OTFDRFx1NTQwRVx1OEZGRFx1NTJBMFx1NUU3Nlx1NjMwMVx1NEU0NVx1NTMxNlx1RkYwOVx1MzAwMlxuICAgKiBcdThGRDRcdTU2REVcdTY1QjBcdTU4OUVcdTY3NjFcdTc2RUVcdTc2ODQgaWRcdUZGMUJcdTgyRTVcdTVERjJcdTVCNThcdTU3MjhcdTUyMTlcdThGRDRcdTU2REVcdTY1RTJcdTY3MDkgaWRcdTMwMDJcbiAgICovXG4gIGFkZFNvbHV0aW9uKGVudHJ5OiBPbWl0PFNvbHV0aW9uRW50cnksIFwicGF0dGVyblwiPiAmIHsgcGF0dGVybjogUmVnRXhwIHwgc3RyaW5nIH0pOiBzdHJpbmcge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWQ6IFNvbHV0aW9uRW50cnkgPSB7XG4gICAgICAuLi5lbnRyeSxcbiAgICAgIHBhdHRlcm46IHR5cGVvZiBlbnRyeS5wYXR0ZXJuID09PSBcInN0cmluZ1wiID8gbmV3IFJlZ0V4cChlbnRyeS5wYXR0ZXJuLCBcImlcIikgOiBlbnRyeS5wYXR0ZXJuLFxuICAgIH07XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmN1c3RvbS5maW5kKChzKSA9PiBzLmlkID09PSBub3JtYWxpemVkLmlkIHx8IHMuZmluZ2VycHJpbnQgPT09IG5vcm1hbGl6ZWQuZmluZ2VycHJpbnQpO1xuICAgIGlmIChleGlzdGluZykgcmV0dXJuIGV4aXN0aW5nLmlkO1xuICAgIHRoaXMuY3VzdG9tLnB1c2gobm9ybWFsaXplZCk7XG4gICAgdGhpcy51bmtub3duLmRlbGV0ZShub3JtYWxpemVkLmZpbmdlcnByaW50KTtcbiAgICBpZiAodGhpcy5maWxlUGF0aCkgdGhpcy5wZXJzaXN0KCk7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZWQuaWQ7XG4gIH1cblxuICAvKiogXHU2NzJBXHU1NDdEXHU0RTJEXHU3Njg0XHU2NUIwXHU5NTE5XHU4QkVGXHU2MzA3XHU3RUI5XHU1MDE5XHU5MDA5ICovXG4gIGdldCB1bmtub3duRXJyb3JzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMudW5rbm93bl07XG4gIH1cblxuICAvKiogXHU2Qzg5XHU2REMwXHU4QkExXHU2NTcwXHVGRjA4XHU4MUVBXHU1QjlBXHU0RTQ5XHU1RTkzXHU4OUM0XHU2QTIxXHVGRjA5ICovXG4gIGdldCBjdXN0b21Db3VudCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbS5sZW5ndGg7XG4gIH1cbn1cblxuLyoqXG4gKiBcdTRGQkZcdTYzNzdcdUZGMUFcdTYyOEFcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTVFOTNcdTVCRkNcdTUxRkFcdTRFM0EgbWFya2Rvd25cdUZGMDhcdTUzRUZcdTRGNUMgUFIgXHU4QkM0XHU4QkJBIC8gXHU1MjM2XHU1NEMxIC8gXHU2NTg3XHU2ODYzXHVGRjA5XHUzMDAyXG4gKiBcdThCQTlcdTMwMENcdTU3MjhcdTdFQkZcdTVFOTNcdTMwMERcdTUzRUZcdTg4QUJcdTUxNzFcdTRFQUJcdTMwMDFcdTVCQTFcdTk2MDVcdTMwMDFcdTcyNDhcdTY3MkNcdTUzMTZcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4cG9ydFNvbHV0aW9uUmVwb01hcmtkb3duKHJlcG86IFNvbHV0aW9uUmVwb3NpdG9yeSwgb3B0czogeyB0aXRsZT86IHN0cmluZyB9ID0ge30pOiBzdHJpbmcge1xuICBjb25zdCBsaW5lcyA9IFtcbiAgICBgIyAke29wdHMudGl0bGUgPz8gXCJcdTk1MTlcdThCRUZcdTgxRUFcdTUyQThcdTUzMzlcdTkxNERcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdTVFOTNcIn1gLFxuICAgIGBcdTUxODVcdTdGNkUgJHtTT0xVVElPTl9QTEFZQk9PSy5sZW5ndGh9IFx1Njc2MSArIFx1NkM4OVx1NkRDMCAke3JlcG8uY3VzdG9tQ291bnR9IFx1Njc2MVx1RkYwQ1x1NTE3MSAke3JlcG8uZW50cmllcy5sZW5ndGh9IFx1Njc2MVx1MzAwMmAsXG4gICAgXCJcIixcbiAgXTtcbiAgZm9yIChjb25zdCBzIG9mIHJlcG8uZW50cmllcykge1xuICAgIGxpbmVzLnB1c2goYCMjIFske3MubGV2ZWx9XSAke3MudGl0bGV9YCk7XG4gICAgbGluZXMucHVzaChgLSBcdTYzMDdcdTdFQjk6IFxcYCR7cy5maW5nZXJwcmludH1cXGBgKTtcbiAgICBsaW5lcy5wdXNoKGAtIFx1NjVCOVx1Njg0ODogJHtzLnNvbHV0aW9ufWApO1xuICAgIGlmIChzLnNraWxsKSBsaW5lcy5wdXNoKGAtIHNraWxsOiAke3Muc2tpbGx9YCk7XG4gICAgaWYgKHMub3BlblNvdXJjZSkgbGluZXMucHVzaChgLSBcdTY1QjlcdTY4NDgvXHU1RjAwXHU2RTkwXHU5ODc5XHU3NkVFOiAke3Mub3BlblNvdXJjZX1gKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9XG4gIGlmIChyZXBvLnVua25vd25FcnJvcnMubGVuZ3RoKSB7XG4gICAgbGluZXMucHVzaChgIyMgXHU1Rjg1XHU2Qzg5XHU2REMwXHU3Njg0XHU2NUIwXHU5NTE5XHU4QkVGXHVGRjA4JHtyZXBvLnVua25vd25FcnJvcnMubGVuZ3RofVx1RkYwOWApO1xuICAgIHJlcG8udW5rbm93bkVycm9ycy5mb3JFYWNoKCh1KSA9PiBsaW5lcy5wdXNoKGAtIFxcYCR7dX1cXGBgKSk7XG4gIH1cbiAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbi8qKlxuICogXHU2MjhBXHU2NUI5XHU2ODQ4XHU1RTkzXHVGRjA4XHU1MTg1XHU3RjZFICsgXHU2Qzg5XHU2REMwXHVGRjA5XHU4RjZDXHU2MjEwXHUzMDBDXHU1M0VGXHU2Q0U4XHU1MTY1IHN5c3RlbSBwcm9tcHQgXHU3Njg0XHU3N0U1XHU4QkM2XHU3MjQ3XHU2QkI1XHUzMDBEXHUzMDAyXG4gKlxuICogXHU4RkQ5XHU2NjJGXHUzMDBDXHU1REYyXHU2Qzg5XHU2REMwXHU2NUI5XHU2ODQ4IFx1MjE5MiBcdTUxQjNcdTdCNTZcdTRFMEFcdTRFMEJcdTY1ODdcdTMwMERcdTc2ODRcdTRFMDBcdTczQUZcdUZGMUFcdTU3MjhcdTdFQkYgQ29kZUJ1ZGR5IFx1NEUwRVx1NjcyQ1x1NTczMCBBZ2VudCBcdTU3MjhcbiAqIFx1OEJDQVx1NjVBRC9cdTg5QzRcdTUyMTJcdTY1RjZcdUZGMENcdTlFRDhcdThCQTRcdTY0M0FcdTVFMjZcdTk4NzlcdTc2RUVcdTkxQ0NcdTVERjJcdTdFQ0ZcdTc5RUZcdTdEMkZcdTc2ODRcdTg5RTNcdTUxQjNcdTY1QjlcdTY4NDhcdUZGMENcdTkwN0ZcdTUxNERcdTkxQ0RcdTU5MERcdTkwMjBcdThGNkVcdTVCNTBcdUZGMENcdTRFNUZcdThCQTlcbiAqIFx1MzAwQ1x1ODlFM1x1NTFCM1x1OEZDN1x1NzY4NFx1OTVFRVx1OTg5OFx1NEUwRFx1NTE4RFx1NEY5RFx1OEQ1Nlx1NTkxNlx1OTBFOFx1NjhDMFx1N0QyMlx1MzAwRFx1OEQyRlx1N0E3Rlx1NTIzMFx1NkJDRlx1NEUwMFx1NkI2NVx1NTFCM1x1N0I1Nlx1MzAwMlxuICpcbiAqIFx1OEZENFx1NTZERVx1N0VEM1x1Njc4NFx1NEUwRSBgYnVpbGRLbm93bGVkZ2VDb250ZXh0YCBcdTc2ODQga25vd2xlZGdlIFx1NTE2NVx1NTNDMlx1NEUwMFx1ODFGNFx1RkYwOHRpdGxlL3NuaXBwZXQvc291cmNlXHVGRjA5XHVGRjBDXG4gKiBcdTU2RTBcdTZCNjRcdTUzRUZcdTc2RjRcdTYzQTVcdTYyRkNcdTYzQTVcdTUyMzBcdTRFRDNcdTVFOTNcdTc3RTVcdThCQzZcdTVFOTNcdTRFMEFcdTRFMEJcdTY1ODdcdTRFNEJcdTU0MEVcdUZGMENcdTYyMTZcdTUzNTVcdTcyRUNcdTZDRThcdTUxNjVcdTMwMDJcbiAqXG4gKiBAcGFyYW0gcmVwbyBcdTY1QjlcdTY4NDhcdTVFOTNcdTVCOUVcdTRGOEJcbiAqIEBwYXJhbSBvcHRzLmluY2x1ZGVCdWlsdGluIFx1NjYyRlx1NTQyNlx1NTMwNVx1NTQyQlx1NTE4NVx1N0Y2RSBwbGF5Ym9va1x1RkYwOFx1OUVEOFx1OEJBNCB0cnVlXHVGRjA5XHVGRjFCXHU0RUM1XHU2MEYzXHU2NDNBXHU1RTI2XHU5ODc5XHU3NkVFXHU2Qzg5XHU2REMwXHU2NUY2XHU4QkJFXHU0RTNBIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFNvbHV0aW9uS25vd2xlZGdlQ29udGV4dChcbiAgcmVwbzogU29sdXRpb25SZXBvc2l0b3J5LFxuICBvcHRzOiB7IGluY2x1ZGVCdWlsdGluPzogYm9vbGVhbjsgc291cmNlPzogc3RyaW5nIH0gPSB7fVxuKTogQXJyYXk8eyB0aXRsZTogc3RyaW5nOyBzbmlwcGV0OiBzdHJpbmc7IHNvdXJjZT86IHN0cmluZyB9PiB7XG4gIGNvbnN0IGluY2x1ZGVCdWlsdGluID0gb3B0cy5pbmNsdWRlQnVpbHRpbiA/PyB0cnVlO1xuICBjb25zdCBlbnRyaWVzID0gaW5jbHVkZUJ1aWx0aW4gPyByZXBvLmVudHJpZXMgOiByZXBvLmN1c3RvbUVudHJpZXM7XG4gIGNvbnN0IHNvdXJjZSA9IG9wdHMuc291cmNlID8/IFwic29sdXRpb25zLXJlcG9cIjtcblxuICByZXR1cm4gZW50cmllcy5tYXAoKHMpID0+ICh7XG4gICAgdGl0bGU6IGBbXHU2NUI5XHU2ODQ4XHUwMEI3JHtzLmxldmVsfV0gJHtzLnRpdGxlfVx1RkYwOFx1NjMwN1x1N0VCOSAke3MuZmluZ2VycHJpbnR9XHVGRjA5YCxcbiAgICBzbmlwcGV0OlxuICAgICAgcy5sZXZlbCA9PT0gXCJhdXRvXCJcbiAgICAgICAgPyBgXHU1M0VGXHU3NkY0XHU2M0E1XHU2MjY3XHU4ODRDXHVGRjFBJHtzLnNvbHV0aW9ufWBcbiAgICAgICAgOiBgXHU2M0E4XHU4MzUwXHU2MDFEXHU4REVGXHVGRjFBJHtzLnNvbHV0aW9ufSR7cy5za2lsbCA/IGBcdUZGMUJcdTUzRUZcdTc1Mjggc2tpbGw6ICR7cy5za2lsbH1gIDogXCJcIn0ke3Mub3BlblNvdXJjZSA/IGBcdUZGMUJcdTUzRUZcdTUzQzJcdTgwMDM6ICR7cy5vcGVuU291cmNlfWAgOiBcIlwifWAsXG4gICAgc291cmNlOiBzLnNvdXJjZSA/PyBzb3VyY2UsXG4gIH0pKTtcbn1cbiIsICIvKipcclxuICogZHNoLW9wZW5saXVsYW4gZGVlcHNlZWsgaGFybmVzcyBcdThGREJcdTdBMEJcdTUxODVcdTZENEZcdTg5QzhcdTU2NjhcdTYzQTdcdTUyMzZcdTYzRDJcdTRFRjZcdTUxNjVcdTUzRTNcdTMwMDJcclxuICpcclxuICogXHU2MjhBIGRzaC1vcGVubGl1bGFuIFx1NzY4NFx1N0VERlx1NEUwMCBBSSBcdTZENEZcdTg5QzhcdTU2NjhcdTYzQTdcdTUyMzZcdTY4NDZcdTY3QjZcdUZGMDhGb3JnZU1DUFx1RkYxQW9ic2VydmUgLyBhY3QgL1xyXG4gKiBkaWFnbm9zZSAvIGV2YWwgLyBzY3JlZW5zaG90IC8gc2Vzc2lvbl9sb2cgLyBjbG9zZVx1RkYwOVx1NkNFOFx1NTE4Q1x1NEUzQSBkZWVwc2Vla1xyXG4gKiBoYXJuZXNzIFx1NzY4NFx1NTM5Rlx1NzUxRlx1NURFNVx1NTE3N1x1RkYwQ1x1NEY5QiBhZ2VudCBcdTc2ODQgdG9vbF9sb29wIFx1NzZGNFx1NjNBNVx1OEMwM1x1NzUyOFx1RkYwQ1x1OTE0RFx1NTQwOCBoYXJuZXNzIFx1NzY4NFxyXG4gKiBcdTUzOUZcdTc1MUYgZnVuY3Rpb24gY2FsbGluZyAvIFx1NTkxQVx1NkI2NVx1ODlDNFx1NTIxMiAvIFx1NjcwOVx1NzJCNlx1NjAwMVx1NEYxQVx1OEJERFx1ODBGRFx1NTI5Qlx1MzAwMlxyXG4gKlxyXG4gKiBcdThCRTVcdTUxNjVcdTUzRTNcdTY2MkZcdTMwMENcdTUzRUZcdTVCODlcdTg4QzVcdTYzRDJcdTRFRjZcdTUzMDVcdTMwMERcdTc2ODRcdTg4QzVcdTkxNERcdTcwQjlcdUZGMUFcdTk4NzZcdTVDNDJcdTUzMDUgcGFja2FnZS5qc29uIFx1NThGMFx1NjYwRVxyXG4gKiBgZHNoLmJ1bmRsZS5wYXRjaGAgXHU2MzA3XHU1NDExIGNvcmRpcy5wYXRjaC55bWxcdUZGMENcdTc1MzEgZHNoIFx1NTNFRlx1NTcyOCBwcm9maWxlIFx1NzZFRVx1NUY1NVx1NEUwMFx1Njc2MVxyXG4gKiBcdTU0N0RcdTRFRTRcdUZGMDhgZHNoIHBsdWdpbiAtLXByb2ZpbGUgd2ViIGFkZCAuLi5gXHVGRjA5XHU1Qjg5XHU4OEM1XHUzMDAyXHU2Nzg0XHU1RUZBXHU2NUY2XHU3NTI4IGVzYnVpbGQgXHU2MjhBXHU2MjQwXHU2NzA5XHJcbiAqIGBAb3BlbmxpdWxhbi8qYCBcdTZFOTBcdTc4MDFcdTUxODVcdTgwNTRcdTYyMTBcdTgxRUFcdTUzMDVcdTU0MkJcdTc2ODQgbGliL2luZGV4LmpzXHVGRjBDXHU1M0VBXHU1OTE2XHU3RjZFXHU1REYyXHU1M0QxXHU1RTAzXHU3Njg0XHJcbiAqIGBwbGF5d3JpZ2h0YFx1RkYwQ1x1NTZFMFx1NkI2NFx1NEUwRFx1NEY5RFx1OEQ1Nlx1NEVGQlx1NEY1NVx1NjcyQVx1NTNEMVx1NUUwMyBucG0gXHU1MzA1XHU1MzczXHU1M0VGXHU4OEFCXHU0RUQ2XHU0RUJBXHU1Qjg5XHU4OEM1XHUzMDAyXHJcbiAqXHJcbiAqIEBtb2R1bGUgQG9wZW5saXVsYW4vZHNoLW9wZW5saXVsYW5cclxuICovXHJcbmltcG9ydCB7IEZvcmdlTWNwIH0gZnJvbSBcIkBvcGVubGl1bGFuL21jcC1zZXJ2ZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBDb250ZXh0IH0gZnJvbSBcIkBkZWVwc2Vlay1haS9jb3JkaXNcIjtcclxuXHJcbi8qKiBDb3JkaXMgXHU2M0QyXHU0RUY2XHU1NDBEXHVGRjA4XHU3NTI4XHU0RThFIGxvYWRlciBcdThCQ0FcdTY1QURcdUZGMDlcdTMwMDIgKi9cclxuZXhwb3J0IGNvbnN0IG5hbWUgPSBcIm9wZW5saXVsYW4tYnJvd3NlclwiO1xyXG4vKiogXHU1REU1XHU1MTc3XHU1NDdEXHU1NDBEXHU1MjREXHU3RjAwXHVGRjBDXHU5MDdGXHU1MTREXHU0RTBFIGhvc3QgXHU1MTc2XHU1QjgzXHU1REU1XHU1MTc3XHU1MUIyXHU3QTgxXHUzMDAyICovXHJcbmNvbnN0IERFRkFVTFRfUFJFRklYID0gXCJicm93c2VyXCI7XHJcblxyXG4vKiogXHU4RkRCXHU3QTBCXHU1MTg1XHU1REU1XHU1MTc3XHU2Q0U4XHU1MThDXHU3Njg0XHU2NzAwXHU1QzBGIGhhcm5lc3MgXHU1OTUxXHU3RUE2XHVGRjA4XHU3RjE2XHU4QkQxXHU2NzFGXHU0RUM1XHU0RjVDXHU1RjYyXHU3MkI2XHU3RUE2XHU2NzVGXHVGRjBDXHU4RkQwXHU4ODRDXHU2NzFGXHU3NTI4XHU1QkJGXHU0RTNCIGN0eFx1RkYwOVx1MzAwMiAqL1xyXG5pbnRlcmZhY2UgSGFybmVzc1Rvb2xSZWdpc3RyeSB7XHJcbiAgcmVnaXN0ZXIoZGVmOiB1bmtub3duKTogKCkgPT4gdm9pZDtcclxufVxyXG5cclxuLyoqIFx1NUJCOVx1OTUxOVx1NTNENlx1NTAzQ1x1RkYxQVx1NjI4QVx1OEMwM1x1NzUyOFx1NTNDMlx1NjU3MFx1NjUzNlx1NjU1Qlx1NEUzQVx1NUJGOVx1OEM2MVx1RkYwOFx1NkEyMVx1NTc4Qlx1NTNFRlx1ODBGRFx1OEY5M1x1NTFGQVx1ODhGOFx1NTAzQ1x1RkYwOVx1MzAwMiAqL1xyXG5mdW5jdGlvbiB0b1JlY29yZChhcmdzOiB1bmtub3duKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xyXG4gIHJldHVybiB0eXBlb2YgYXJncyA9PT0gXCJvYmplY3RcIiAmJiBhcmdzICE9PSBudWxsID8gKGFyZ3MgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pIDoge307XHJcbn1cclxuXHJcbi8qKiBcdTYyOEEgRm9yZ2VNQ1AgXHU4QzAzXHU3NTI4XHU2NUI5XHU4RkQ0XHU1NkRFXHU1MDNDXHU2NjIwXHU1QzA0XHU0RTNBIGhhcm5lc3MgQ29udGVudEJsb2NrIFx1NjU4N1x1NjcyQ1x1MzAwMiAqL1xyXG5mdW5jdGlvbiByZXN1bHRUZXh0KGNvbnRlbnQ6IHJlYWRvbmx5IHsgdHlwZT86IHN0cmluZzsgdGV4dD86IHN0cmluZyB9W10gfCB1bmRlZmluZWQpOiBzdHJpbmcge1xyXG4gIGlmICghY29udGVudCB8fCBjb250ZW50Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiKFx1NjVFMFx1OEY5M1x1NTFGQSlcIjtcclxuICByZXR1cm4gY29udGVudC5tYXAoKGJsb2NrKSA9PiBibG9jay50ZXh0ID8/IFwiXCIpLmpvaW4oXCJcXG5cIik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3JkaXMgXHU2M0QyXHU0RUY2XHU1MTY1XHU1M0UzXHVGRjFBXHU2Nzg0XHU5MDIwXHU0RTAwXHU0RTJBXHU4RkRCXHU3QTBCXHU1MTg1XHU3Njg0IEZvcmdlTWNwIFx1NUI5RVx1NEY4Qlx1RkYwQ1x1NjI4QVx1NTE3Nlx1NURFNVx1NTE3N1x1NjYyMFx1NUMwNFx1NEUzQVxyXG4gKiBkZWVwc2VlayBoYXJuZXNzIFx1NzY4NCBUb29sRGVmaW5pdGlvbiBcdTVFNzZcdTZDRThcdTUxOENcdTUyMzAgYGN0eC50b29sc2BcdTMwMDJcclxuICpcclxuICogXHU5MTREXHU3RjZFXHVGRjA4XHU1M0VGXHU1NzI4IGNvcmRpcy5wYXRjaC55bWwgXHU4OTg2XHU3NkQ2XHVGRjA5XHVGRjFBXHJcbiAqIC0gYGhlYWRsZXNzYDogXHU2NUUwXHU1OTM0XHU2QTIxXHU1RjBGXHVGRjA4XHU5RUQ4XHU4QkE0IHRydWVcdUZGMDlcclxuICogLSBgY29ubmVjdFVybGA6IFx1NTNFRlx1OTAwOVx1RkYwQ0NEUCBcdThGREVcdTYzQTVcdTVERjJcdTU0MkZcdTUyQThcdTc2ODRcdTZENEZcdTg5QzhcdTU2NjhcclxuICogLSBgcHJlZml4YDogXHU1REU1XHU1MTc3XHU1NDdEXHU1NDBEXHU1MjREXHU3RjAwXHVGRjA4XHU5RUQ4XHU4QkE0IFwiYnJvd3NlclwiXHVGRjA5XHJcbiAqIC0gYHN0ZWFsdGhgOiBcdTUzRUZcdTkwMDlcdUZGMENcdTk2MzJcdTY4QzBcdTZENEJcdTkxNERcdTdGNkVcclxuICpcclxuICogQHBhcmFtIGN0eCAtIFx1NjNEMlx1NEVGNlx1NEUwQVx1NEUwQlx1NjU4N1x1RkYwOFx1NUJCRlx1NEUzQlx1NkNFOFx1NTE2NVx1RkYwQ1x1NTQyQlx1NURFNVx1NTE3N1x1NkNFOFx1NTE4Q1x1NjcwRFx1NTJBMVx1RkYwOVx1MzAwMlxyXG4gKiBAcGFyYW0gY29uZmlnIC0gXHU4OUUzXHU2NzkwXHU1NDBFXHU3Njg0XHU2M0QyXHU0RUY2XHU5MTREXHU3RjZFXHUzMDAyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkoY3R4OiBDb250ZXh0LCBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge30pOiB2b2lkIHtcclxuICBjb25zdCBwcmVmaXggPSB0eXBlb2YgY29uZmlnLnByZWZpeCA9PT0gXCJzdHJpbmdcIiAmJiBjb25maWcucHJlZml4ID8gY29uZmlnLnByZWZpeCA6IERFRkFVTFRfUFJFRklYO1xyXG4gIGNvbnN0IG1jcCA9IG5ldyBGb3JnZU1jcCh7XHJcbiAgICBoZWFkbGVzczogY29uZmlnLmhlYWRsZXNzID09PSB1bmRlZmluZWQgPyB0cnVlIDogQm9vbGVhbihjb25maWcuaGVhZGxlc3MpLFxyXG4gICAgY29ubmVjdFVybDogdHlwZW9mIGNvbmZpZy5jb25uZWN0VXJsID09PSBcInN0cmluZ1wiID8gY29uZmlnLmNvbm5lY3RVcmwgOiB1bmRlZmluZWQsXHJcbiAgICBzdGVhbHRoOiAoY29uZmlnLnN0ZWFsdGggYXMgbmV2ZXIpID8/IHVuZGVmaW5lZCxcclxuICB9KTtcclxuXHJcbiAgY29uc3QgdG9vbHMgPSAoY3R4IGFzIHVua25vd24gYXMgeyB0b29sczogSGFybmVzc1Rvb2xSZWdpc3RyeSB9KS50b29scztcclxuXHJcbiAgZm9yIChjb25zdCB0b29sIG9mIG1jcC50b29scykge1xyXG4gICAgY29uc3QgcGFyYW1ldGVycyA9ICh0b29sLmlucHV0U2NoZW1hIGFzIHsgcHJvcGVydGllcz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0pLnByb3BlcnRpZXMgPz8ge307XHJcbiAgICBjb25zdCBwdWJsaWNOYW1lID0gYCR7cHJlZml4fV8ke3Rvb2wubmFtZX1gO1xyXG4gICAgY3R4LmVmZmVjdChcclxuICAgICAgKCkgPT5cclxuICAgICAgICB0b29scy5yZWdpc3Rlcih7XHJcbiAgICAgICAgICBuYW1lOiBwdWJsaWNOYW1lLFxyXG4gICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXHJcbiAgICAgICAgICBwYXJhbWV0ZXJzLFxyXG4gICAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICAgIHNjaGVtYToge1xyXG4gICAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXHJcbiAgICAgICAgICAgICAgcHJvcGVydGllczogeyBjb250ZW50OiB7IHR5cGU6IFwiYXJyYXlcIiwgaXRlbXM6IHt9IH0gfSxcclxuICAgICAgICAgICAgICByZXF1aXJlZDogW1wiY29udGVudFwiXSxcclxuICAgICAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlbmRlcihfYXJnczogdW5rbm93biwgdmFsdWU6IHVua25vd24pOiB1bmtub3duW10ge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHRleHQgPSByZXN1bHRUZXh0KCgodmFsdWUgYXMgeyBjb250ZW50PzogeyB0eXBlPzogc3RyaW5nOyB0ZXh0Pzogc3RyaW5nIH1bXSB9KSA/PyB7fSkuY29udGVudCA/PyBbXSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFt7IHR5cGU6IFwidGV4dFwiLCB0ZXh0IH1dO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGV4ZWN1dGU6IGFzeW5jIChhcmdzOiB1bmtub3duKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG1jcC5jYWxsVG9vbCh0b29sLm5hbWUsIHRvUmVjb3JkKGFyZ3MpKTtcclxuICAgICAgICAgICAgY29uc3QgdGV4dCA9IHJlc3VsdFRleHQocmVzdWx0LmNvbnRlbnQpO1xyXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5vaykgdGhyb3cgbmV3IEVycm9yKHRleHQpO1xyXG4gICAgICAgICAgICByZXR1cm4geyBpc0Vycm9yOiBmYWxzZSwgdmFsdWU6IHsgY29udGVudDogdGV4dCB9LCBjb250ZW50OiBbeyB0eXBlOiBcInRleHRcIiwgdGV4dCB9XSB9O1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgXCJvcGVubGl1bGFuLnRvb2xcIixcclxuICAgICk7XHJcbiAgfVxyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFVTyxTQUFTLGVBQWUsU0FBNEU7QUFDekcsUUFBTSxPQUF3QixDQUFDO0FBQy9CLFFBQU0sY0FBd0IsQ0FBQztBQUMvQixRQUFNLFNBQVMsUUFBUSxPQUFPLENBQUMsTUFBTSxFQUFFLFVBQVUsT0FBTyxFQUFFLEtBQUs7QUFDL0QsUUFBTSxPQUFPLFFBQVEsT0FBTyxDQUFDLE1BQU0sRUFBRSxhQUFhLEdBQUk7QUFFdEQsYUFBVyxLQUFLLFFBQVE7QUFDdEIsU0FBSyxLQUFLO0FBQUEsTUFDUixNQUFNO0FBQUEsTUFDTixVQUFVLEVBQUUsVUFBVSxNQUFNLFVBQVU7QUFBQSxNQUN0QyxTQUFTLDRCQUFRLEVBQUUsTUFBTSxJQUFJLEVBQUUsR0FBRyxLQUFLLEVBQUUsTUFBTSxHQUFHLEVBQUUsYUFBYSxNQUFNLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxRQUFRLGFBQVEsRUFBRSxRQUFRLEVBQUU7QUFBQSxNQUMxSCxRQUFRLEVBQUUsWUFBWSxFQUFFLFlBQVksV0FBVyxFQUFFLFVBQVU7QUFBQSxNQUMzRCxXQUFXLEtBQUssSUFBSTtBQUFBLElBQ3RCLENBQUM7QUFBQSxFQUNIO0FBQ0EsYUFBVyxLQUFLLE1BQU07QUFDcEIsU0FBSyxLQUFLO0FB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QUFDVixXQUFPLElBQUksV0FBVTtBQUFBLE1BQ2pCLEdBQUcsS0FBSztBQUFBLE1BQ1IsUUFBUSxDQUFDLEdBQUcsS0FBSyxLQUFLLFFBQVEsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUFBLElBQ3pELENBQUM7QUFBQSxFQUNMO0FBQUEsRUFDQSxJQUFJLGFBQWE7QUFDYixXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsVUFBVTtBQUFBLEVBQ2pFO0FBQUEsRUFDQSxJQUFJLFNBQVM7QUFDVCxXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsTUFBTTtBQUFBLEVBQzdEO0FBQUEsRUFDQSxJQUFJLFNBQVM7QUFDVCxXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsTUFBTTtBQUFBLEVBQzdEO0FBQUEsRUFDQSxJQUFJLGFBQWE7QUFDYixXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsVUFBVTtBQUFBLEVBQ2pFO0FBQUEsRUFDQSxJQUFJLFVBQVU7QUFDVixXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsT0FBTztBQUFBLEVBQzlEO0FBQUEsRUFDQSxJQUFJLFFBQVE7QUFDUixXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsS0FBSztBQUFBLEVBQzVEO0FBQUEsRUFDQSxJQUFJLFVBQVU7QUFDVixXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsT0FBTztBQUFBLEVBQzlEO0FBQUEsRUFDQSxJQUFJLFNBQVM7QUFDVCxXQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsTUFBTTtBQUFBLEVBQzdEO0FBQUEs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QUFBLFFBQ0EsU0FBUyxPQUFPLFNBQWtCO0FBQ2hDLGdCQUFNLFNBQVMsTUFBTSxJQUFJLFNBQVMsS0FBSyxNQUFNLFNBQVMsSUFBSSxDQUFDO0FBQzNELGdCQUFNLE9BQU8sV0FBVyxPQUFPLE9BQU87QUFDdEMsY0FBSSxDQUFDLE9BQU8sR0FBSSxPQUFNLElBQUksTUFBTSxJQUFJO0FBQ3BDLGlCQUFPLEVBQUUsU0FBUyxPQUFPLE9BQU8sRUFBRSxTQUFTLEtBQUssR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLFFBQVEsS0FBSyxDQUFDLEVBQUU7QUFBQSxRQUN2RjtBQUFBLE1BQ0YsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJ1dGlsIiwgIm9iamVjdFV0aWwiLCAiZXJyb3JVdGlsIiwgImVycm9yTWFwIiwgImN0eCIsICJyZXN1bHQiLCAibWFzayIsICJpc3N1ZXMiLCAiZWxlbWVudHMiLCAicHJvY2Vzc2VkIiwgInJlc3VsdCIsICJyIiwgIlpvZEZpcnN0UGFydHlUeXBlS2luZCIsICJtYXhOb2RlcyIsICJtYXhUZXh0IiwgIndpdGhTZWxlY3RvcnMiLCAiUFJVTkVfVEFHUyIsICJURVhUX1RBR1MiLCAiQVRUUl9XSElURUxJU1QiLCAiSU5URVJBQ1RJVkVfVEFHUyIsICJJTlRFUkFDVElWRV9ST0xFUyIsICJzY29yZSIsICJuYW1lIiwgInN1bW1hcml6ZSJdCn0K
