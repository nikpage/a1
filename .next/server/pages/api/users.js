"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/api/users";
exports.ids = ["pages/api/users"];
exports.modules = {

/***/ "@supabase/supabase-js":
/*!****************************************!*\
  !*** external "@supabase/supabase-js" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("@supabase/supabase-js");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "(api)/./lib/supabase.js":
/*!*************************!*\
  !*** ./lib/supabase.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   supabase: () => (/* binding */ supabase)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/supabase-js */ \"@supabase/supabase-js\");\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__);\n// lib/supabase.js\n\nconst supabaseUrl = \"https://ybfvkdxeusgqdwbekcxm.supabase.co\";\nconst supabaseAnonKey = \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnZrZHhldXNncWR3YmVrY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NzcyMDcsImV4cCI6MjA2MzE1MzIwN30.NPS8bDXk5x9tFT0Ma7chac_TOO91QI_0UOoqLVjKhKI\";\nconst supabase = (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__.createClient)(supabaseUrl, supabaseAnonKey);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaSkvLi9saWIvc3VwYWJhc2UuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsa0JBQWtCO0FBQ21DO0FBRXJELE1BQU1DLGNBQWNDLDBDQUFvQ0U7QUFDeEQsTUFBTUMsa0JBQWtCSCxrTkFBeUNJO0FBRTFELE1BQU1DLFdBQVdQLG1FQUFZQSxDQUFDQyxhQUFhSSxpQkFBaUIiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9jdi1haS1tdnAvLi9saWIvc3VwYWJhc2UuanM/MTU5OCJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBsaWIvc3VwYWJhc2UuanNcbmltcG9ydCB7IGNyZWF0ZUNsaWVudCB9IGZyb20gJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcyc7XG5cbmNvbnN0IHN1cGFiYXNlVXJsID0gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfU1VQQUJBU0VfVVJMO1xuY29uc3Qgc3VwYWJhc2VBbm9uS2V5ID0gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfU1VQQUJBU0VfQU5PTl9LRVk7XG5cbmV4cG9ydCBjb25zdCBzdXBhYmFzZSA9IGNyZWF0ZUNsaWVudChzdXBhYmFzZVVybCwgc3VwYWJhc2VBbm9uS2V5KTtcbiJdLCJuYW1lcyI6WyJjcmVhdGVDbGllbnQiLCJzdXBhYmFzZVVybCIsInByb2Nlc3MiLCJlbnYiLCJORVhUX1BVQkxJQ19TVVBBQkFTRV9VUkwiLCJzdXBhYmFzZUFub25LZXkiLCJORVhUX1BVQkxJQ19TVVBBQkFTRV9BTk9OX0tFWSIsInN1cGFiYXNlIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(api)/./lib/supabase.js\n");

/***/ }),

/***/ "(api)/./pages/api/users.js":
/*!****************************!*\
  !*** ./pages/api/users.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var _lib_supabase__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../lib/supabase */ \"(api)/./lib/supabase.js\");\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! crypto */ \"crypto\");\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_1__);\n// pages/api/users.js\n\n\nasync function handler(req, res) {\n    if (req.method !== \"POST\") {\n        return res.status(405).json({\n            error: \"Method Not Allowed\"\n        });\n    }\n    try {\n        // generate a secret for the “secret-URL” login\n        const secret = (0,crypto__WEBPACK_IMPORTED_MODULE_1__.randomUUID)();\n        const { data , error  } = await _lib_supabase__WEBPACK_IMPORTED_MODULE_0__.supabase.from(\"users\").insert({\n            secret\n        }).select(\"id, secret\").single();\n        if (error) throw error;\n        res.status(200).json({\n            userId: data.id,\n            secret: data.secret\n        });\n    } catch (error) {\n        console.error(\"User creation error:\", error);\n        res.status(500).json({\n            error: error.message\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaSkvLi9wYWdlcy9hcGkvdXNlcnMuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLHFCQUFxQjtBQUN5QjtBQUNWO0FBRXJCLGVBQWVFLFFBQVFDLEdBQUcsRUFBRUMsR0FBRztJQUM1QyxJQUFJRCxJQUFJRSxXQUFXLFFBQVE7UUFDekIsT0FBT0QsSUFBSUUsT0FBTyxLQUFLQyxLQUFLO1lBQUVDLE9BQU87UUFBcUI7SUFDNUQ7SUFFQSxJQUFJO1FBQ0YsK0NBQStDO1FBQy9DLE1BQU1DLFNBQVNSLGtEQUFVQTtRQUN6QixNQUFNLEVBQUVTLEtBQUksRUFBRUYsTUFBSyxFQUFFLEdBQUcsTUFBTVIsbURBQVFBLENBQ25DVyxLQUFLLFNBQ0xDLE9BQU87WUFBRUg7UUFBTyxHQUNoQkksT0FBTyxjQUNQQztRQUVILElBQUlOLE9BQU8sTUFBTUE7UUFFakJKLElBQUlFLE9BQU8sS0FBS0MsS0FBSztZQUNuQlEsUUFBUUwsS0FBS007WUFDYlAsUUFBUUMsS0FBS0Q7UUFDZjtJQUNGLEVBQUUsT0FBT0QsT0FBTztRQUNkUyxRQUFRVCxNQUFNLHdCQUF3QkE7UUFDdENKLElBQUlFLE9BQU8sS0FBS0MsS0FBSztZQUFFQyxPQUFPQSxNQUFNVTtRQUFRO0lBQzlDO0FBQ0YiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9jdi1haS1tdnAvLi9wYWdlcy9hcGkvdXNlcnMuanM/NDlmNiJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBwYWdlcy9hcGkvdXNlcnMuanNcbmltcG9ydCB7IHN1cGFiYXNlIH0gZnJvbSAnLi4vLi4vbGliL3N1cGFiYXNlJztcbmltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tICdjcnlwdG8nO1xuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKHJlcSwgcmVzKSB7XG4gIGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDUpLmpzb24oeyBlcnJvcjogJ01ldGhvZCBOb3QgQWxsb3dlZCcgfSk7XG4gIH1cblxuICB0cnkge1xuICAgIC8vIGdlbmVyYXRlIGEgc2VjcmV0IGZvciB0aGUg4oCcc2VjcmV0LVVSTOKAnSBsb2dpblxuICAgIGNvbnN0IHNlY3JldCA9IHJhbmRvbVVVSUQoKTtcbiAgICBjb25zdCB7IGRhdGEsIGVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZVxuICAgICAgLmZyb20oJ3VzZXJzJylcbiAgICAgIC5pbnNlcnQoeyBzZWNyZXQgfSlcbiAgICAgIC5zZWxlY3QoJ2lkLCBzZWNyZXQnKVxuICAgICAgLnNpbmdsZSgpO1xuXG4gICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcblxuICAgIHJlcy5zdGF0dXMoMjAwKS5qc29uKHtcbiAgICAgIHVzZXJJZDogZGF0YS5pZCxcbiAgICAgIHNlY3JldDogZGF0YS5zZWNyZXQsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignVXNlciBjcmVhdGlvbiBlcnJvcjonLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbInN1cGFiYXNlIiwicmFuZG9tVVVJRCIsImhhbmRsZXIiLCJyZXEiLCJyZXMiLCJtZXRob2QiLCJzdGF0dXMiLCJqc29uIiwiZXJyb3IiLCJzZWNyZXQiLCJkYXRhIiwiZnJvbSIsImluc2VydCIsInNlbGVjdCIsInNpbmdsZSIsInVzZXJJZCIsImlkIiwiY29uc29sZSIsIm1lc3NhZ2UiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(api)/./pages/api/users.js\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../webpack-api-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(api)/./pages/api/users.js"));
module.exports = __webpack_exports__;

})();