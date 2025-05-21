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

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var _lib_supabase__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../lib/supabase */ \"(api)/./lib/supabase.js\");\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! crypto */ \"crypto\");\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_1__);\n// pages/api/users.js\n\n\nasync function handler(req, res) {\n    // Lookup existing user by secret\n    if (req.method === \"GET\") {\n        const { secret  } = req.query;\n        if (!secret) {\n            return res.status(400).json({\n                error: \"Secret is required\"\n            });\n        }\n        const { data: user , error  } = await _lib_supabase__WEBPACK_IMPORTED_MODULE_0__.supabase.from(\"users\").select(\"email, tokens\").eq(\"secret\", secret).single();\n        if (error || !user) {\n            return res.status(404).json({\n                error: \"User not found\"\n            });\n        }\n        return res.status(200).json(user);\n    }\n    // Create new or update existing user\n    if (req.method === \"POST\") {\n        const { secret , email  } = req.body;\n        try {\n            // Update existing user if secret + email provided\n            if (secret && email) {\n                const { data: updated , error: updErr  } = await _lib_supabase__WEBPACK_IMPORTED_MODULE_0__.supabase.from(\"users\").update({\n                    email\n                }).eq(\"secret\", secret).select(\"email, tokens\").single();\n                if (updErr || !updated) {\n                    return res.status(404).json({\n                        error: \"User not found for update\"\n                    });\n                }\n                return res.status(200).json({\n                    email: updated.email,\n                    tokens: updated.tokens\n                });\n            }\n            // Otherwise create a new user\n            const newSecret = (0,crypto__WEBPACK_IMPORTED_MODULE_1__.randomUUID)();\n            const { data , error  } = await _lib_supabase__WEBPACK_IMPORTED_MODULE_0__.supabase.from(\"users\").insert({\n                secret: newSecret\n            }).select(\"id, secret, tokens\").single();\n            if (error) throw error;\n            return res.status(200).json({\n                userId: data.id,\n                secret: data.secret,\n                tokens: data.tokens\n            });\n        } catch (error) {\n            console.error(\"User creation/update error:\", error);\n            return res.status(500).json({\n                error: error.message\n            });\n        }\n    }\n    // Only GET and POST supported\n    res.setHeader(\"Allow\", [\n        \"GET\",\n        \"POST\"\n    ]);\n    return res.status(405).json({\n        error: \"Method Not Allowed\"\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaSkvLi9wYWdlcy9hcGkvdXNlcnMuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLHFCQUFxQjtBQUN5QjtBQUNWO0FBRXJCLGVBQWVFLFFBQVFDLEdBQUcsRUFBRUMsR0FBRztJQUM1QyxpQ0FBaUM7SUFDakMsSUFBSUQsSUFBSUUsV0FBVyxPQUFPO1FBQ3hCLE1BQU0sRUFBRUMsT0FBTSxFQUFFLEdBQUdILElBQUlJO1FBQ3ZCLElBQUksQ0FBQ0QsUUFBUTtZQUNYLE9BQU9GLElBQUlJLE9BQU8sS0FBS0MsS0FBSztnQkFBRUMsT0FBTztZQUFxQjtRQUM1RDtRQUNBLE1BQU0sRUFBRUMsTUFBTUMsS0FBSSxFQUFFRixNQUFLLEVBQUUsR0FBRyxNQUFNVixtREFBUUEsQ0FDekNhLEtBQUssU0FDTEMsT0FBTyxpQkFDUEMsR0FBRyxVQUFVVCxRQUNiVTtRQUNILElBQUlOLFNBQVMsQ0FBQ0UsTUFBTTtZQUNsQixPQUFPUixJQUFJSSxPQUFPLEtBQUtDLEtBQUs7Z0JBQUVDLE9BQU87WUFBaUI7UUFDeEQ7UUFDQSxPQUFPTixJQUFJSSxPQUFPLEtBQUtDLEtBQUtHO0lBQzlCO0lBRUEscUNBQXFDO0lBQ3JDLElBQUlULElBQUlFLFdBQVcsUUFBUTtRQUN6QixNQUFNLEVBQUVDLE9BQU0sRUFBRVcsTUFBSyxFQUFFLEdBQUdkLElBQUllO1FBQzlCLElBQUk7WUFDRixrREFBa0Q7WUFDbEQsSUFBSVosVUFBVVcsT0FBTztnQkFDbkIsTUFBTSxFQUFFTixNQUFNUSxRQUFPLEVBQUVULE9BQU9VLE9BQU0sRUFBRSxHQUFHLE1BQU1wQixtREFBUUEsQ0FDcERhLEtBQUssU0FDTFEsT0FBTztvQkFBRUo7Z0JBQU0sR0FDZkYsR0FBRyxVQUFVVCxRQUNiUSxPQUFPLGlCQUNQRTtnQkFDSCxJQUFJSSxVQUFVLENBQUNELFNBQVM7b0JBQ3RCLE9BQU9mLElBQUlJLE9BQU8sS0FBS0MsS0FBSzt3QkFBRUMsT0FBTztvQkFBNEI7Z0JBQ25FO2dCQUNBLE9BQU9OLElBQUlJLE9BQU8sS0FBS0MsS0FBSztvQkFBRVEsT0FBT0UsUUFBUUY7b0JBQU9LLFFBQVFILFFBQVFHO2dCQUFPO1lBQzdFO1lBQ0EsOEJBQThCO1lBQzlCLE1BQU1DLFlBQVl0QixrREFBVUE7WUFDNUIsTUFBTSxFQUFFVSxLQUFJLEVBQUVELE1BQUssRUFBRSxHQUFHLE1BQU1WLG1EQUFRQSxDQUNuQ2EsS0FBSyxTQUNMVyxPQUFPO2dCQUFFbEIsUUFBUWlCO1lBQVUsR0FDM0JULE9BQU8sc0JBQ1BFO1lBQ0gsSUFBSU4sT0FBTyxNQUFNQTtZQUNqQixPQUFPTixJQUFJSSxPQUFPLEtBQUtDLEtBQUs7Z0JBQUVnQixRQUFRZCxLQUFLZTtnQkFBSXBCLFFBQVFLLEtBQUtMO2dCQUFRZ0IsUUFBUVgsS0FBS1c7WUFBTztRQUMxRixFQUFFLE9BQU9aLE9BQU87WUFDZGlCLFFBQVFqQixNQUFNLCtCQUErQkE7WUFDN0MsT0FBT04sSUFBSUksT0FBTyxLQUFLQyxLQUFLO2dCQUFFQyxPQUFPQSxNQUFNa0I7WUFBUTtRQUNyRDtJQUNGO0lBRUEsOEJBQThCO0lBQzlCeEIsSUFBSXlCLFVBQVUsU0FBUztRQUFDO1FBQU87S0FBTztJQUN0QyxPQUFPekIsSUFBSUksT0FBTyxLQUFLQyxLQUFLO1FBQUVDLE9BQU87SUFBcUI7QUFDNUQiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9jdi1haS1tdnAvLi9wYWdlcy9hcGkvdXNlcnMuanM/NDlmNiJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBwYWdlcy9hcGkvdXNlcnMuanNcbmltcG9ydCB7IHN1cGFiYXNlIH0gZnJvbSAnLi4vLi4vbGliL3N1cGFiYXNlJztcbmltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tICdjcnlwdG8nO1xuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKHJlcSwgcmVzKSB7XG4gIC8vIExvb2t1cCBleGlzdGluZyB1c2VyIGJ5IHNlY3JldFxuICBpZiAocmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICBjb25zdCB7IHNlY3JldCB9ID0gcmVxLnF1ZXJ5O1xuICAgIGlmICghc2VjcmV0KSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ1NlY3JldCBpcyByZXF1aXJlZCcgfSk7XG4gICAgfVxuICAgIGNvbnN0IHsgZGF0YTogdXNlciwgZXJyb3IgfSA9IGF3YWl0IHN1cGFiYXNlXG4gICAgICAuZnJvbSgndXNlcnMnKVxuICAgICAgLnNlbGVjdCgnZW1haWwsIHRva2VucycpXG4gICAgICAuZXEoJ3NlY3JldCcsIHNlY3JldClcbiAgICAgIC5zaW5nbGUoKTtcbiAgICBpZiAoZXJyb3IgfHwgIXVzZXIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnVXNlciBub3QgZm91bmQnIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzLnN0YXR1cygyMDApLmpzb24odXNlcik7XG4gIH1cblxuICAvLyBDcmVhdGUgbmV3IG9yIHVwZGF0ZSBleGlzdGluZyB1c2VyXG4gIGlmIChyZXEubWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICBjb25zdCB7IHNlY3JldCwgZW1haWwgfSA9IHJlcS5ib2R5O1xuICAgIHRyeSB7XG4gICAgICAvLyBVcGRhdGUgZXhpc3RpbmcgdXNlciBpZiBzZWNyZXQgKyBlbWFpbCBwcm92aWRlZFxuICAgICAgaWYgKHNlY3JldCAmJiBlbWFpbCkge1xuICAgICAgICBjb25zdCB7IGRhdGE6IHVwZGF0ZWQsIGVycm9yOiB1cGRFcnIgfSA9IGF3YWl0IHN1cGFiYXNlXG4gICAgICAgICAgLmZyb20oJ3VzZXJzJylcbiAgICAgICAgICAudXBkYXRlKHsgZW1haWwgfSlcbiAgICAgICAgICAuZXEoJ3NlY3JldCcsIHNlY3JldClcbiAgICAgICAgICAuc2VsZWN0KCdlbWFpbCwgdG9rZW5zJylcbiAgICAgICAgICAuc2luZ2xlKCk7XG4gICAgICAgIGlmICh1cGRFcnIgfHwgIXVwZGF0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ1VzZXIgbm90IGZvdW5kIGZvciB1cGRhdGUnIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDIwMCkuanNvbih7IGVtYWlsOiB1cGRhdGVkLmVtYWlsLCB0b2tlbnM6IHVwZGF0ZWQudG9rZW5zIH0pO1xuICAgICAgfVxuICAgICAgLy8gT3RoZXJ3aXNlIGNyZWF0ZSBhIG5ldyB1c2VyXG4gICAgICBjb25zdCBuZXdTZWNyZXQgPSByYW5kb21VVUlEKCk7XG4gICAgICBjb25zdCB7IGRhdGEsIGVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZVxuICAgICAgICAuZnJvbSgndXNlcnMnKVxuICAgICAgICAuaW5zZXJ0KHsgc2VjcmV0OiBuZXdTZWNyZXQgfSlcbiAgICAgICAgLnNlbGVjdCgnaWQsIHNlY3JldCwgdG9rZW5zJylcbiAgICAgICAgLnNpbmdsZSgpO1xuICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDIwMCkuanNvbih7IHVzZXJJZDogZGF0YS5pZCwgc2VjcmV0OiBkYXRhLnNlY3JldCwgdG9rZW5zOiBkYXRhLnRva2VucyB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignVXNlciBjcmVhdGlvbi91cGRhdGUgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gT25seSBHRVQgYW5kIFBPU1Qgc3VwcG9ydGVkXG4gIHJlcy5zZXRIZWFkZXIoJ0FsbG93JywgWydHRVQnLCAnUE9TVCddKTtcbiAgcmV0dXJuIHJlcy5zdGF0dXMoNDA1KS5qc29uKHsgZXJyb3I6ICdNZXRob2QgTm90IEFsbG93ZWQnIH0pO1xufVxuIl0sIm5hbWVzIjpbInN1cGFiYXNlIiwicmFuZG9tVVVJRCIsImhhbmRsZXIiLCJyZXEiLCJyZXMiLCJtZXRob2QiLCJzZWNyZXQiLCJxdWVyeSIsInN0YXR1cyIsImpzb24iLCJlcnJvciIsImRhdGEiLCJ1c2VyIiwiZnJvbSIsInNlbGVjdCIsImVxIiwic2luZ2xlIiwiZW1haWwiLCJib2R5IiwidXBkYXRlZCIsInVwZEVyciIsInVwZGF0ZSIsInRva2VucyIsIm5ld1NlY3JldCIsImluc2VydCIsInVzZXJJZCIsImlkIiwiY29uc29sZSIsIm1lc3NhZ2UiLCJzZXRIZWFkZXIiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(api)/./pages/api/users.js\n");

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