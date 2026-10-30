(function () {
  'use strict'

  var DEFAULT_OUTLINE_WIDTH = 220
  var MIN_OUTLINE_WIDTH = 190
  var state = { mode: 'preview', theme: 'default', pinned: false, outlineWidth: DEFAULT_OUTLINE_WIDTH, outlineExpanded: Object.create(null), headingCollapsed: Object.create(null), activeOutlineIndex: 0, outlineNavigationPending: null, vscodeDark: false, renderTheme: null, renderEditor: null, documentText: null }
  var outline
  var handle
  var menu
  var tableContextMenu
  var tableContextCellPosition
  var hoverBlock
  var hideHandleTimer
  var enhanceTimer
  var savedInsertRange
  var savedTableRange
  var lastTableCell
  var lastTableCellPosition
  var tablePanelRequested = false
  var activeLayoutTable
  var tableLayoutToolbar
  var tableHeaderMenu
  var tableToolbarHideTimer
  var tableLayoutResizeObserver
  var tableLayoutFrame
  var tableResizeSession
  var pendingTableStructure
  var pendingTableTransaction
  var pendingTableTransactionTimer
  var tableSynchronousLayoutApplying = false
  var activeTableDivider
  var tableSelectorLayer
  var tableSelectorPointer
  var tableSelectorHover
  var tableSelectorFrame
  var tableSelectorAutoScrollFrame
  var tableCompositionCell
  var tableRangePointer
  var tableRangeSelection
  var pendingTableRangeRestore
  var tableRangeAutoScrollFrame
  var suppressTableRangeClick = false
  var tableInputViewportLock
  var tableInputViewportFrame
  var tableLayoutSessions = Object.create(null)
  var tableScrollSessions = Object.create(null)
  var tableViewportWidthSessions = Object.create(null)
  var activeTableScrollIntent
  var stickyTableHeader
  var stickyTableFrame
  var tableDocumentListenersBound = false
  var graphicToolbar
  var activeGraphicBlock
  var graphicToolbarHideTimer
  var graphicFullscreenStage
  var graphicFullscreenView
  var graphicEditDispatching = false
  var graphicListenersBound = false
  var graphicPointerX = -1
  var graphicPointerY = -1
  var mermaidLabelEditor
  var splitScrollFrame
  var splitScrollPending
  var splitExpectedScroll = new WeakMap()
  var splitInputScrollLock
  var lastSplitInputAt = 0
  var splitDivider
  var splitLineNumberFrame
  var splitActiveLineFrame
  var splitLineNumberSource
  var splitLineNumberObserver
  var splitLineNumberResizeObserver
  var splitLineLayoutCache
  var yamlOverlayMap = new Map()
  var previewYamlFrame
  var previewYamlComposing = false
  var previewYamlTokens = new WeakMap()
  var previewMermaidTokens = new WeakMap()
  var previewCodeTokens = new WeakMap()
  var chartResizeObserver
  var chartResizeFrame
  var outlineTooltip
  var outlineTooltipTimer
  var linkTooltip
  var linkTooltipTimer
  var linkTooltipRequest = 0
  var activeLinkPreview
  var linkPreviewCache = new Map()
  var externalLinkOverlayLayer
  var externalLinkOverlays = new Map()
  var outlineRailResizeObserver
  var outlineRailResizeFrame
  var headingFoldLayer
  var headingFoldFrame
  var splitSourceToolsTimer
  var splitSourceToolsCache
  var splitSourceComposing = false
  var splitSetextRuns = null
  var splitHorizontalRuleEntries = null
  var splitHorizontalRuleRestoreTimer = null
  var splitSameTextFrame
  var activeSelectionTimer
  var pendingActiveSelection
  var findReplaceController
  var horizontalRuleEdit
  var markdownValueBridge
  var previewFrontMatterEdit
  var yamlMarkerEdit
  var previewStableMarkdown = null
  var TABLE_TOP_RAIL_HEIGHT = 14
  var TABLE_LEFT_RAIL_WIDTH = 16

  function outlineChevronSvg(direction) {
    var path = direction === 'right' ? 'M8 5l7 7-7 7' : direction === 'up' ? 'M5 16l7-7 7 7' : 'M5 8l7 7 7-7'
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"></path></svg>'
  }

  function outlinePinSvg(pinned) {
    return pinned ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5-3 1-3 3 1 5-2 2-3-5-5-3 2-2 5 1 3-3 1-3Z"></path><path d="m9 15-5 5"></path></svg>'
  }

  function ensureOutlineTooltip() {
    if (outlineTooltip) return outlineTooltip
    outlineTooltip = document.createElement('div')
    outlineTooltip.id = 'eyan-outline-tooltip'
    outlineTooltip.setAttribute('role', 'tooltip')
    document.body.appendChild(outlineTooltip)
    return outlineTooltip
  }

  function hideOutlineTooltip() {
    clearTimeout(outlineTooltipTimer)
    if (outlineTooltip) outlineTooltip.classList.remove('eyan-visible')
  }

  function ensureLinkTooltip() {
    if (linkTooltip) return linkTooltip
    linkTooltip = document.createElement('div')
    linkTooltip.id = 'eyan-link-tooltip'
    linkTooltip.setAttribute('role', 'tooltip')
    document.body.appendChild(linkTooltip)
    return linkTooltip
  }

  function hideLinkTooltip() {
    clearTimeout(linkTooltipTimer)
    activeLinkPreview = null
    linkTooltipRequest++
    if (linkTooltip) linkTooltip.classList.remove('eyan-visible')
  }

  function positionLinkTooltip(target) {
    if (!linkTooltip || !target || !target.isConnected) return
    var rect = target.getBoundingClientRect()
    var tooltipRect = linkTooltip.getBoundingClientRect()
    var left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltipRect.width - 8))
    var top = rect.bottom + 7
    if (top + tooltipRect.height > window.innerHeight - 8) top = rect.top - tooltipRect.height - 7
    linkTooltip.style.left = left + 'px'
    linkTooltip.style.top = Math.max(8, top) + 'px'
  }

  function showLinkTooltip(target, display) {
    if (!activeLinkPreview || activeLinkPreview.target !== target || !display) return
    var tooltip = ensureLinkTooltip()
    tooltip.textContent = display
    tooltip.classList.add('eyan-visible')
    positionLinkTooltip(target)
  }

  function renderedLinkAt(target) {
    var element = target && (target.nodeType === 1 ? target : target.parentElement)
    if (!element) return null
    var surface = state.mode === 'split'
      ? document.querySelector('.vditor-preview .vditor-reset')
      : document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
    if (!surface || !surface.contains(element)) return null
    var anchor = element.closest('a')
    var linkNode = element.closest('[data-type="a"]')
    var linkTarget = anchor || linkNode
    if (!linkTarget || !surface.contains(linkTarget)) return null
    var marker = linkNode && linkNode.querySelector('.vditor-ir__marker--link')
    var href = (anchor && anchor.getAttribute('href')) || (marker && marker.textContent) || ''
    href = href.trim()
    if (!href || href[0] === '#') return null
    return { target: linkTarget, href: href }
  }

  function isExternalRenderedLink(href) {
    return /^(?:https?|mailto):/i.test(String(href || '').trim())
  }

  function bindNativeExternalAnchor(anchor) {
    if (!anchor || anchor.tagName !== 'A' || !isExternalRenderedLink(anchor.getAttribute('href'))) return null
    anchor.dataset.eyanNativeLink = '1'
    return anchor
  }

  function ensureExternalLinkOverlayLayer() {
    if (externalLinkOverlayLayer) return externalLinkOverlayLayer
    externalLinkOverlayLayer = document.createElement('div')
    externalLinkOverlayLayer.id = 'eyan-external-link-layer'
    document.body.appendChild(externalLinkOverlayLayer)
    return externalLinkOverlayLayer
  }

  function positionExternalLinkOverlays() {
    externalLinkOverlays.forEach(function (anchor, target) {
      if (!target.isConnected) {
        anchor.remove()
        externalLinkOverlays.delete(target)
        return
      }
      var rect = target.getBoundingClientRect()
      var visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
      anchor.style.display = visible ? 'block' : 'none'
      if (!visible) return
      anchor.style.left = rect.left + 'px'
      anchor.style.top = rect.top + 'px'
      anchor.style.width = rect.width + 'px'
      anchor.style.height = rect.height + 'px'
    })
  }

  function syncExternalLinkOverlays(links) {
    var active = new Set(links.map(function (link) { return link.target }))
    externalLinkOverlays.forEach(function (anchor, target) {
      if (active.has(target)) return
      anchor.remove()
      externalLinkOverlays.delete(target)
    })
    if (!links.length) return
    var layer = ensureExternalLinkOverlayLayer()
    links.forEach(function (link) {
      var anchor = externalLinkOverlays.get(link.target)
      if (!anchor) {
        anchor = document.createElement('a')
        anchor.className = 'eyan-native-link-overlay'
        anchor.dataset.eyanNativeLink = '1'
        anchor.setAttribute('aria-label', link.target.textContent || link.href)
        anchor.addEventListener('click', function (event) { event.stopPropagation() })
        anchor.addEventListener('mouseenter', function () {
          scheduleLinkTooltip({ target: anchor, href: anchor.href })
        })
        anchor.addEventListener('mouseleave', hideLinkTooltip)
        layer.appendChild(anchor)
        externalLinkOverlays.set(link.target, anchor)
      }
      anchor.href = link.href
      anchor.dataset.eyanLinkHref = link.href
    })
    positionExternalLinkOverlays()
  }

  function enhanceExternalLinks() {
    var roots = []
    var ir = document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
    var split = document.querySelector('.vditor-preview .vditor-reset')
    if (ir) roots.push(ir)
    if (split && split !== ir) roots.push(split)
    roots.forEach(function (root) {
      root.querySelectorAll('a[href]').forEach(bindNativeExternalAnchor)
      root.querySelectorAll('[data-type="a"]').forEach(function (node) {
        var marker = node.querySelector('.vditor-ir__marker--link')
        var href = marker && (marker.textContent || '').trim()
        if (!isExternalRenderedLink(href)) return
        var label = node.querySelector('.vditor-ir__link')
        if (!label) return
        if (label.tagName === 'A') {
          if (!label.getAttribute('href')) label.setAttribute('href', href)
          bindNativeExternalAnchor(label)
        }
      })
    })
    // External links are dispatched through one capture-phase bridge. Remove
    // legacy transparent anchors so a click cannot race native navigation and
    // the extension fallback.
    syncExternalLinkOverlays([])
  }

  function scheduleLinkTooltip(link) {
    clearTimeout(linkTooltipTimer)
    var requestId = ++linkTooltipRequest
    activeLinkPreview = { target: link.target, href: link.href, requestId: requestId }
    linkTooltipTimer = setTimeout(function () {
      if (!activeLinkPreview || activeLinkPreview.requestId !== requestId) return
      if (/^https?:\/\//i.test(link.href)) {
        showLinkTooltip(link.target, link.href)
        return
      }
      if (linkPreviewCache.has(link.href)) {
        showLinkTooltip(link.target, linkPreviewCache.get(link.href))
        return
      }
      if (window.vscode && typeof window.vscode.postMessage === 'function') {
        window.vscode.postMessage({ command: 'resolve-link-preview', requestId: requestId, href: link.href })
      }
    }, 260)
  }

  function handleLinkMouseOver(event) {
    var link = renderedLinkAt(event.target)
    if (!link) return
    if (isExternalRenderedLink(link.href) && link.target.tagName !== 'A') enhanceExternalLinks()
    if (activeLinkPreview && activeLinkPreview.target === link.target) return
    scheduleLinkTooltip(link)
  }

  function handleLinkMouseOut(event) {
    if (!activeLinkPreview) return
    var next = event.relatedTarget && (event.relatedTarget.nodeType === 1 ? event.relatedTarget : event.relatedTarget.parentElement)
    if (next && activeLinkPreview.target.contains(next)) return
    hideLinkTooltip()
  }

  function handleRenderedLinkClick(event) {
    var link = renderedLinkAt(event.target)
    if (!link) return
    event.preventDefault()
    event.stopPropagation()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    if (window.vscode && typeof window.vscode.postMessage === 'function') {
      window.vscode.postMessage({ command: 'open-link', href: link.href })
    }
  }

  function showOutlineTooltip(row) {
    clearTimeout(outlineTooltipTimer)
    var text = row.dataset.tooltip
    if (!text) return
    outlineTooltipTimer = setTimeout(function () {
      var tooltip = ensureOutlineTooltip()
      tooltip.textContent = text
      tooltip.classList.add('eyan-visible')
      var rect = row.getBoundingClientRect()
      var tooltipRect = tooltip.getBoundingClientRect()
      var left = rect.left - tooltipRect.width - 8
      var top = rect.top + (rect.height - tooltipRect.height) / 2
      tooltip.style.left = Math.max(8, left) + 'px'
      tooltip.style.top = Math.max(8, Math.min(window.innerHeight - tooltipRect.height - 8, top)) + 'px'
    }, 2000)
  }

  function applyOutlinePreferences(message) {
    if (typeof message.pinned === 'boolean') state.pinned = message.pinned
    var width = Number(message.outlineWidth)
    if (isFinite(width)) state.outlineWidth = Math.max(MIN_OUTLINE_WIDTH, Math.min(520, width))
    document.documentElement.style.setProperty('--eyan-outline-width', state.outlineWidth + 'px')
    if (!outline) return
    outline.classList.toggle('eyan-pinned', state.pinned)
    outline.classList.toggle('eyan-collapse-now', !state.pinned)
    outline.classList.remove('eyan-just-unpinned')
    document.body.classList.toggle('eyan-outline-pinned', state.pinned)
    document.body.style.setProperty('--eyan-outline-width', state.outlineWidth + 'px')
    var pin = outline.querySelector('#eyan-outline-pin')
    if (pin) {
      pin.innerHTML = outlinePinSvg(state.pinned)
      pin.title = state.pinned ? 'Close pinned outline' : 'Pin outline'
      pin.setAttribute('aria-label', pin.title)
      pin.dataset.tooltip = state.pinned ? 'Close outline' : 'Pin outline'
    }
  }

  function getEditor() {
    if (window.vditor && window.vditor.vditor) return window.vditor
    try {
      if (typeof vditor !== 'undefined' && vditor && vditor.vditor) return vditor
    } catch (_) {}
    return null
  }

  function normalizedMarkdownText(markdown) {
    return String(markdown || '').replace(/\r\n?/g, '\n')
  }

  function leadingMarkdownPrefix(markdown) {
    var source = normalizedMarkdownText(markdown)
    var index = firstNonEmptyLineIndex(source.split('\n'))
    if (index <= 0) return ''
    var lines = source.split('\n')
    return lines.slice(0, index).join('\n') + '\n'
  }

  function frontMatterRange(markdown) {
    var lines = normalizedMarkdownText(markdown).split('\n')
    var first = lines[0] || ''
    if (first.charCodeAt(0) === 0xFEFF) first = first.slice(1)
    if (!/^---[ \t]*$/.test(first)) return null
    for (var index = 1; index < lines.length; index++) {
      if (/^---[ \t]*$/.test(lines[index])) return { open: 0, close: index }
    }
    return null
  }

  function firstNonEmptyLineIndex(lines) {
    for (var index = 0; index < lines.length; index++) {
      if (lines[index].trim()) return index
    }
    return -1
  }

  function markdownRenderValue(markdown) {
    var source = normalizedMarkdownText(markdown)
    if (frontMatterRange(source)) return source.charCodeAt(0) === 0xFEFF ? source.slice(1) : source
    var lines = source.split('\n')
    var firstIndex = firstNonEmptyLineIndex(lines)
    if (firstIndex < 0) return source
    var line = lines[firstIndex]
    var withoutBom = line.charCodeAt(0) === 0xFEFF ? line.slice(1) : line
    // Lute promotes the first non-empty `---` to frontmatter even when the
    // physical file starts with a blank line or the pair is incomplete. A
    // spaced thematic-break form is rendered as a real <hr> while the value
    // bridge keeps the user's literal `---` in the Markdown source.
    if (!/^---[ \t]*$/.test(withoutBom)) return source
    var trailing = withoutBom.match(/[ \t]*$/)[0]
    var renderedRule = '- - -' + trailing
    lines[firstIndex] = line.charCodeAt(0) === 0xFEFF ? '\uFEFF' + renderedRule : renderedRule
    return lines.join('\n')
  }

  function installMarkdownValueBridge(editor) {
    if (!editor || editor.__eyanMarkdownValueBridge) return
    var originalGetValue = editor.getValue.bind(editor)
    var originalSetValue = editor.setValue.bind(editor)
    var bridge = { originalGetValue: originalGetValue, originalSetValue: originalSetValue, source: null, rendered: null, setting: false }
    editor.__eyanMarkdownValueBridge = bridge
    markdownValueBridge = bridge
    editor.getValue = function () {
      var rendered = originalGetValue()
      if (bridge.setting || bridge.source === null) return rendered
      if (bridge.rendered !== null && rendered === bridge.rendered) return bridge.source
      // Once the DOM has changed, let Vditor report the live edit. The source
      // snapshot is only a render-time compatibility layer.
      return rendered
    }
    editor.setValue = function (value, ...args) {
      var source = normalizedMarkdownText(value)
      var rendered = markdownRenderValue(source)
      bridge.source = source.endsWith('\n') ? source : source + '\n'
      bridge.rendered = null
      bridge.setting = true
      var result = originalSetValue(rendered, ...args)
      bridge.setting = false
      requestAnimationFrame(function () {
        bridge.rendered = originalGetValue()
      })
      return result
    }
    bridge.originalSetValue = originalSetValue
  }

  function nativeMarkdownValue(editor) {
    if (markdownValueBridge && typeof markdownValueBridge.originalGetValue === 'function') {
      return normalizedMarkdownText(markdownValueBridge.originalGetValue())
    }
    return normalizedMarkdownText(editor && typeof editor.getValue === 'function' ? editor.getValue() : '')
  }

  function setMarkdownBridgeSource(editor, source) {
    var next = normalizedMarkdownText(source)
    if (markdownValueBridge) {
      markdownValueBridge.source = next.endsWith('\n') ? next : next + '\n'
      markdownValueBridge.rendered = nativeMarkdownValue(editor)
    }
    state.documentText = next
    previewStableMarkdown = next
  }

  function notifyMarkdownEdit(editor, source) {
    setMarkdownBridgeSource(editor, source)
    if (editor && editor.vditor && editor.vditor.options && typeof editor.vditor.options.input === 'function') {
      editor.vditor.options.input(source)
    } else if (window.vscode && typeof window.vscode.postMessage === 'function') {
      window.vscode.postMessage({ command: 'edit', content: source })
    }
  }
  function getReset() {
    if (state.mode === 'split') {
      return document.querySelector('.vditor-preview .vditor-reset') || document.querySelector('.vditor-sv.vditor-reset')
    }
    return document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
  }

  function switchVditorMode(editor, mode) {
    if (editor.getCurrentMode && editor.getCurrentMode() === mode) return true
    var button = document.querySelector('.vditor-toolbar button[data-mode="' + mode + '"]')
    if (!button) return false
    button.click()
    return !editor.getCurrentMode || editor.getCurrentMode() === mode
  }

  function guardReadonlySurface() {
    var reset = state.mode === 'split'
      ? document.querySelector('.vditor-sv.vditor-reset')
      : document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
    if (!reset) return
    if (!reset.dataset.eyanReadonlyGuard) {
      var stopVditorEdit = function (event) {
        if (state.mode !== 'readonly') return
        var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement)
        if (!isReadonlyInteractiveTarget(target)) event.stopPropagation()
      }
      reset.addEventListener('mousedown', stopVditorEdit, true)
      reset.addEventListener('dblclick', stopVditorEdit, true)
      reset.addEventListener('click', stopVditorEdit, true)
      reset.addEventListener('keydown', function (event) {
        if (state.mode !== 'readonly') return
        if (!(event.ctrlKey || event.metaKey) || !['a', 'c', 'f'].includes(event.key.toLowerCase())) event.stopPropagation()
      }, true)
      reset.dataset.eyanReadonlyGuard = '1'
    }
    var editable = state.mode !== 'readonly' ? 'true' : 'false'
    // Rewriting contenteditable on every character mutation resets the caret in
    // VS Code's webview. Only touch these attributes when their value changed.
    if (reset.getAttribute('contenteditable') !== editable) reset.setAttribute('contenteditable', editable)
    if (reset.getAttribute('spellcheck') !== 'false') reset.setAttribute('spellcheck', 'false')
  }

  function isReadonlyInteractiveTarget(target) {
    if (!target || !target.closest) return false
    return !!target.closest('a, [data-type="a"], input[type="checkbox"], button, .eyan-copy-button, img, ' + GRAPHIC_DIAGRAM_SELECTOR)
  }

  function readonlyRenderedSurfaceFor(target) {
    var element = target && (target.nodeType === 1 ? target : target.parentElement)
    if (!element) return null
    if (state.mode === 'readonly') {
      var readonlyRoot = document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
      return readonlyRoot && readonlyRoot.contains(element) ? readonlyRoot : null
    }
    if (state.mode === 'split') {
      var previewRoot = document.querySelector('.vditor-preview .vditor-reset')
      return previewRoot && previewRoot.contains(element) ? previewRoot : null
    }
    return null
  }

  function replaceTaskCheckboxAt(markdown, index, checked) {
    var count = -1
    var fence = null
    return String(markdown || '').replace(/^.*$/gm, function (line) {
      var fenceMatch = line.match(/^\s*(?:>\s*)*(`{3,}|~{3,})/)
      if (fenceMatch) {
        var marker = fenceMatch[1]
        if (!fence) fence = { character: marker[0], length: marker.length }
        else if (marker[0] === fence.character && marker.length >= fence.length) fence = null
        return line
      }
      if (fence) return line
      var task = line.match(/^((?:\s*>\s*)*\s*(?:[-+*]|\d+[.)])\s+)\[([ xX])\]/)
      if (!task) return line
      count += 1
      if (count !== index) return line
      return task[1] + '[' + (checked ? 'x' : ' ') + ']' + line.slice(task[0].length)
    })
  }

  function handleReadonlyInteractionClick(event) {
    var surface = readonlyRenderedSurfaceFor(event.target)
    if (!surface) return
    var checkbox = event.target.closest && event.target.closest('input[type="checkbox"]')
    if (!checkbox || !surface.contains(checkbox)) return
    var checkboxes = Array.from(surface.querySelectorAll('input[type="checkbox"]'))
    var index = checkboxes.indexOf(checkbox)
    if (index < 0) return
    event.stopPropagation()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    // Checkbox state is already toggled when the click event is dispatched.
    // Do not cancel the default action. Commit the Markdown in this same task:
    // getValue/save/mode switching must never observe the old checkbox DOM.
    var nextChecked = checkbox.checked
    var previousChecked = !nextChecked
    var editor = getEditor()
    if (state.mode === 'split') {
      if (!commitSplitTaskCheckbox(editor, checkbox, index, nextChecked)) checkbox.checked = previousChecked
      return
    }
    var markdown = typeof state.documentText === 'string'
      ? state.documentText
      : (editor && typeof editor.getValue === 'function' ? editor.getValue() : '')
    var next = replaceTaskCheckboxAt(markdown, index, nextChecked)
    if (next === markdown) {
      Promise.resolve().then(function () { if (checkbox.isConnected) checkbox.checked = previousChecked })
      return
    }
    checkbox.checked = nextChecked
    if (editor && typeof editor.setValue === 'function') {
      // IR serialization reads checked attributes, not just the live property.
      // A deferred setValue left getValue free to overwrite documentText with
      // stale Markdown. Use the captured next value synchronously instead.
      var selection = window.getSelection()
      if (selection && !selection.rangeCount) {
        var range = document.createRange()
        range.setStart(document.body, 0)
        range.collapse(true)
        selection.addRange(range)
      }
      editor.setValue(next, false)
      if (state.mode === 'readonly' && selection) selection.removeAllRanges()
    }
    state.documentText = next
    if (window.vscode && typeof window.vscode.postMessage === 'function') window.vscode.postMessage({ command: 'edit', content: next })
    enhanceReadonlyInteractions()
    scheduleEnhance()
  }

  function ensureSplitTaskTracking(editor) {
    var internal = editor && editor.vditor
    var preview = internal && internal.preview
    if (!preview || preview.__eyanTaskSync) return
    var tracking = preview.__eyanTaskSync = { pendingSource: null, renderedSource: null }
    var render = preview.render
    var parse = internal.options.preview.parse
    preview.render = function () {
      tracking.pendingSource = internal.sv.element.textContent
      return render.apply(this, arguments)
    }
    internal.options.preview.parse = function () {
      tracking.renderedSource = tracking.pendingSource
      tracking.pendingSource = null
      if (typeof parse === 'function') return parse.apply(this, arguments)
    }
  }

  function commitSplitTaskCheckbox(editor, checkbox, index, checked) {
    var internal = editor && editor.vditor
    if (!internal || internal.currentMode !== 'sv') return false
    var source = internal.sv.element
    var before = source.textContent
    // Only parser-recognized task markers participate: examples inside code
    // fences and ordinary bracket text must not shift the checkbox index.
    var markers = Array.from(source.querySelectorAll('[data-type="task-marker"]')).filter(function (node) {
      return /^[ xX]$/.test(node.textContent) && node.previousElementSibling &&
        node.previousElementSibling.getAttribute('data-type') === 'task-marker' &&
        node.previousElementSibling.textContent === '['
    })
    var marker = markers[index]
    var preview = internal.preview
    var tracking = preview.__eyanTaskSync
    if (!marker || markers.length !== preview.previewElement.querySelectorAll('input[type="checkbox"]').length) return false
    if (tracking && tracking.renderedSource !== null && tracking.renderedSource !== before) {
      // A stale preview cannot identify a task by ordinal if the source task
      // list was just changed/reordered. Let its queued render catch up rather
      // than checking a different task. Ordinary pending paragraph edits remain
      // eligible for the local update below. This comparison is deliberately
      // conservative for task-looking examples inside fenced source as well.
      var taskLines = /^((?:\s*>\s*)*\s*(?:[-+*]|\d+[.)])\s+)\[[ xX]\].*$/gm
      if ((before.match(taskLines) || []).join('\n') !== (tracking.renderedSource.match(taskLines) || []).join('\n')) return false
    }
    // Flush any previous source edit before making this an independent undo
    // step. Do not dispatch input: that would schedule a whole preview rebuild.
    clearTimeout(internal.sv.processTimeoutId)
    internal.undo.addToUndoStack(internal)
    if (marker.childNodes.length === 1 && marker.firstChild.nodeType === Node.TEXT_NODE) {
      marker.firstChild.replaceData(0, 1, checked ? 'x' : ' ')
    } else marker.textContent = checked ? 'x' : ' '
    marker.classList.toggle('vditor-sv__marker--strong', checked)
    marker.classList.toggle('vditor-sv__marker--bi', !checked)
    checkbox.toggleAttribute('checked', checked)
    checkbox.checked = checked
    internal.undo.addToUndoStack(internal)
    var next = editor.getValue()
    state.documentText = next
    if (tracking && tracking.renderedSource === before) {
      // The rendered document differs only in this checkbox. Cancel a redundant
      // pending render rather than replacing charts/tables and losing anchors.
      clearTimeout(preview.mdTimeoutId)
      tracking.pendingSource = null
      tracking.renderedSource = source.textContent
    } else {
      // A preceding left-pane edit has not reached the preview yet. Preserve
      // that edit, replace its stale render request with the latest source, and
      // use the same viewport protection as ordinary source typing.
      lastSplitInputAt = Date.now()
      lockSplitPreviewDuringInput(source)
      preview.render(internal)
    }
    if (window.vscode && typeof window.vscode.postMessage === 'function') window.vscode.postMessage({ command: 'edit', content: next })
    scheduleSplitSourceTools(true)
    return true
  }

  function enhanceReadonlyInteractions() {
    var roots = []
    if (state.mode === 'readonly') {
      var readonlyRoot = document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
      if (readonlyRoot) roots.push(readonlyRoot)
    } else if (state.mode === 'split') {
      var previewRoot = document.querySelector('.vditor-preview .vditor-reset')
      if (previewRoot) roots.push(previewRoot)
    }
    roots.forEach(function (root) {
      root.querySelectorAll('input[type="checkbox"]').forEach(function (checkbox) {
        checkbox.disabled = false
        checkbox.dataset.eyanReadonlyTask = '1'
      })
    })
  }

  function clearInlineEditingState() {
    document.querySelectorAll('.vditor-ir__node--expand').forEach(function (node) {
      node.classList.remove('vditor-ir__node--expand')
    })
    var selection = window.getSelection()
    if (selection) selection.removeAllRanges()
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur()
  }

  // A soft break (Shift+Enter) leaves a bare "\n" at the end of the paragraph's
  // text. Vditor drops that newline on its next render, so a "-" typed on the
  // new visual line merges back onto the prose line: two dashes then read as a
  // setext underline, which is what padded the run out and threw the caret to
  // the top of the document. Promote the trailing soft break to a real
  // paragraph break before the dash lands, so the rule starts its own block.
  function promoteTrailingSoftBreakForRule() {
    if (state.mode !== 'preview') return false
    var selection = window.getSelection()
    if (!selection || !selection.isCollapsed || !selection.anchorNode) return false
    var node = selection.anchorNode
    if (node.nodeType !== Node.TEXT_NODE) return false
    var paragraph = node.parentElement && node.parentElement.closest('.vditor-ir .vditor-reset p')
    if (!paragraph) return false
    var text = node.nodeValue || ''
    // Only when the caret sits directly after a trailing newline, i.e. on the
    // empty visual line the soft break just opened.
    if (selection.anchorOffset !== text.length || !/\n$/.test(text)) return false
    if (!text.slice(0, -1).trim()) return false
    // Work on the DOM rather than the source: setValue rebuilds the surface
    // asynchronously, which loses the caret. Vditor's IR mode serializes from
    // the DOM, so splitting the block here keeps the caret and gives the dash
    // its own paragraph.
    node.nodeValue = text.slice(0, -1)
    var block = document.createElement('p')
    block.setAttribute('data-block', '0')
    block.appendChild(document.createTextNode('-'))
    if (paragraph.nextSibling) paragraph.parentNode.insertBefore(block, paragraph.nextSibling)
    else paragraph.parentNode.appendChild(block)
    var range = document.createRange()
    range.setStart(block.firstChild, 1)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    var editor = getEditor()
    if (editor && typeof editor.getValue === 'function') {
      var next = editor.getValue()
      state.documentText = next
      if (window.vscode && typeof window.vscode.postMessage === 'function') window.vscode.postMessage({ command: 'edit', content: next })
    }
    return true
  }

  function horizontalRuleSourceEntries(markdown) {
    var lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
    var entries = []
    var fence = null
    var frontMatter = frontMatterRange(markdown)
    lines.forEach(function (line, index) {
      if (frontMatter && index >= frontMatter.open && index <= frontMatter.close) {
        return
      }
      var fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[1][0]
        else if (fenceMatch[1][0] === fence) fence = null
        return
      }
      if (fence) return
      if (!/^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) return
      var previous = index > 0 ? lines[index - 1] : ''
      // A non-empty prose line followed immediately by ---/=== is a setext
      // heading, not a thematic break. Rendered <hr> ordinals must skip it.
      if (previous.trim() && !/^\s*(?:[-+*]|\d+[.)]|>|#|`{3,}|~{3,}|\|)/.test(previous)) return
      entries.push({ index: index, indent: (line.match(/^\s*/) || [''])[0], token: line.trim() })
    })
    return entries
  }

  function restoreSplitHorizontalRuleTokens(current, entries) {
    var source = normalizedMarkdownText(current)
    if (!entries || !entries.length) return source
    var lines = source.split('\n')
    var changed = false
    entries.forEach(function (entry) {
      if (!entry || entry.index < 0 || entry.index >= lines.length) return
      var line = lines[entry.index] || ''
      if (!/^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) return
      if ((line.trim() || '') === entry.token) return
      lines[entry.index] = entry.indent + entry.token
      changed = true
    })
    return changed ? lines.join('\n') : source
  }

  function restoreSplitHorizontalRuleSurface() {
    if (state.mode !== 'split' || !splitHorizontalRuleEntries || !splitHorizontalRuleEntries.length) return false
    var source = document.querySelector('.vditor-sv')
    if (!source) return false
    var markers = Array.from(source.querySelectorAll('.vditor-sv__marker'))
      .filter(function (candidate) {
        var type = candidate.getAttribute('data-type') || ''
        if (type === 'heading-marker' || /^yaml-front-matter-/.test(type)) return false
        return /^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test((candidate.textContent || '').trim())
      })
    var changed = false
    splitHorizontalRuleEntries.forEach(function (entry, ordinal) {
      var marker = markers.find(function (candidate) {
        return splitSourceLineIndex(source, candidate) === entry.index
      }) || markers[ordinal]
      if (!marker) return
      var current = (marker.textContent || '').trim()
      if (current === entry.token) return
      marker.textContent = entry.token
      changed = true
    })
    if (changed) splitSourceToolsCache = null
    return changed
  }

  function scheduleSplitHorizontalRuleRestore() {
    clearTimeout(splitHorizontalRuleRestoreTimer)
    splitHorizontalRuleRestoreTimer = setTimeout(function () {
      splitHorizontalRuleRestoreTimer = null
      restoreSplitHorizontalRuleSurface()
    }, 120)
  }

  function ensureSplitHorizontalRuleGetValue(editor) {
    if (!editor || typeof editor.getValue !== 'function' || editor.__eyanSplitHorizontalRuleGetValue) return
    var originalGetValue = editor.getValue.bind(editor)
    editor.getValue = function () {
      var current = originalGetValue()
      return state.mode === 'split'
        ? restoreSplitHorizontalRuleTokens(current, splitHorizontalRuleEntries)
        : current
    }
    editor.__eyanSplitHorizontalRuleGetValue = true
  }

  function ensureSplitHorizontalRuleInput(editor) {
    var options = editor && editor.vditor && editor.vditor.options
    if (!options || typeof options.input !== 'function' || options.__eyanSplitHorizontalRuleInput) return
    var originalInput = options.input
    options.input = function (value) {
      var next = state.mode === 'split'
        ? restoreSplitHorizontalRuleTokens(value, splitHorizontalRuleEntries)
        : value
      return originalInput.call(this, next)
    }
    options.__eyanSplitHorizontalRuleInput = true
  }

  function horizontalRuleOrdinal(node) {
    var reset = node && node.closest && node.closest('.vditor-ir .vditor-reset')
    if (!reset) return -1
    return Array.from(reset.querySelectorAll('hr')).indexOf(node)
  }

  function protectExtendedHorizontalRuleLines(markdown) {
    // The Markdown rule accepts any run of three or more markers. Keep the
    // original token and let the value bridge preserve it across Vditor's
    // canonical `---` serialization.
    return String(markdown || '')
  }

  function restoreHorizontalRuleEdit() {
    if (!horizontalRuleEdit) return
    var edit = horizontalRuleEdit
    horizontalRuleEdit = null
    if (edit.editor && edit.editor.isConnected && edit.editor.parentNode) {
      edit.editor.replaceWith(edit.rule)
    }
  }

  function focusAfterHorizontalRuleEdit(ordinal) {
    requestAnimationFrame(function () {
      var reset = document.querySelector('.vditor-ir .vditor-reset')
      if (!reset) return
      var hr = reset.querySelectorAll('hr')[ordinal]
      var next = hr && hr.nextElementSibling
      if (!next || next.tagName !== 'P') return
      var target = next.querySelector('wbr') || next
      var range = document.createRange()
      if (target.tagName === 'WBR') range.setStartBefore(target)
      else {
        range.selectNodeContents(target)
        range.collapse(false)
      }
      var selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      var editor = getEditor()
      if (editor && typeof editor.focus === 'function') editor.focus()
    })
  }

  function commitHorizontalRuleEdit(withNextParagraph) {
    if (!horizontalRuleEdit) return false
    var edit = horizontalRuleEdit
    var editor = getEditor()
    if (!editor || typeof editor.getValue !== 'function' || typeof editor.setValue !== 'function') {
      restoreHorizontalRuleEdit()
      return false
    }
    var markdown = edit.baselineMarkdown
    var sourceEntry = { index: edit.sourceIndex, indent: edit.indent, token: edit.token }
    var value = (edit.editor.textContent || '').replace(/\r?\n/g, ' ').trim()
    if (sourceEntry.index < 0) {
      restoreHorizontalRuleEdit()
      return false
    }
    var lines = markdown.replace(/\r\n?/g, '\n').split('\n')
    var nextLine = value ? sourceEntry.indent + value : ''
    var changed = lines[sourceEntry.index] !== nextLine
    lines[sourceEntry.index] = nextLine
    if (withNextParagraph && lines[sourceEntry.index + 1] !== '') {
      lines.splice(sourceEntry.index + 1, 0, '')
      changed = true
    }
    var next = lines.join('\n')
    horizontalRuleEdit = null
    if (!changed) {
      if (edit.editor.isConnected && edit.editor.parentNode) edit.editor.replaceWith(edit.rule)
      if (withNextParagraph) focusAfterHorizontalRuleEdit(edit.ordinal)
      return false
    }
    if (edit.editor.isConnected && edit.editor.parentNode) edit.editor.remove()
    state.documentText = next
    // Markdown parsers accept three or more dashes as a thematic break. The
    // editor's rule interaction treats exactly `---` as the rendered rule, so
    // keep longer runs as visible text by adding zero-width separators only to
    // the renderer input. Vditor strips them back out of getValue().
    editor.setValue(next, false)
    if (window.vscode && typeof window.vscode.postMessage === 'function') window.vscode.postMessage({ command: 'edit', content: next })
    if (withNextParagraph) focusAfterHorizontalRuleEdit(edit.ordinal)
    return true
  }

  function beginHorizontalRuleEdit(rule) {
    if (state.mode !== 'preview' || !rule || !rule.isConnected) return false
    if (horizontalRuleEdit && horizontalRuleEdit.rule === rule) return true
    if (horizontalRuleEdit) commitHorizontalRuleEdit(false)
    var editor = getEditor()
    if (!editor || typeof editor.getValue !== 'function') return false
    var ordinal = horizontalRuleOrdinal(rule)
    if (ordinal < 0) return false
    var entries = horizontalRuleSourceEntries(editor.getValue())
    var token = entries[ordinal] ? entries[ordinal].token : '---'
    var paragraph = document.createElement('p')
    paragraph.className = 'eyan-horizontal-rule-editing'
    paragraph.setAttribute('data-block', '0')
    paragraph.setAttribute('data-eyan-horizontal-rule-editing', '1')
    paragraph.setAttribute('contenteditable', 'true')
    paragraph.setAttribute('spellcheck', 'false')
    paragraph.setAttribute('tabindex', '0')
    paragraph.textContent = token || '---'
    paragraph.addEventListener('beforeinput', function (event) { event.stopPropagation() }, true)
    paragraph.addEventListener('input', function (event) { event.stopPropagation() }, true)
    paragraph.addEventListener('keydown', function (event) {
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        restoreHorizontalRuleEdit()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        commitHorizontalRuleEdit(true)
      }
    }, true)
    paragraph.addEventListener('click', function (event) { event.stopPropagation() }, true)
    rule.replaceWith(paragraph)
    horizontalRuleEdit = {
      rule: rule,
      editor: paragraph,
      ordinal: ordinal,
      token: token,
      baselineMarkdown: editor.getValue(),
      sourceIndex: entries[ordinal] ? entries[ordinal].index : -1,
      indent: entries[ordinal] ? entries[ordinal].indent : ''
    }
    var text = paragraph.firstChild
    var range = document.createRange()
    range.setStart(text, text.length)
    range.collapse(true)
    var selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
    if (typeof paragraph.focus === 'function') paragraph.focus({ preventScroll: true })
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
    return true
  }

  function syncVditorRenderTheme() {
    var editor = getEditor()
    if (!editor || typeof editor.setTheme !== 'function') return
    var renderTheme = state.theme === 'default' && state.vscodeDark ? 'dark' : 'light'
    var editorChanged = state.renderEditor !== editor
    if (!editorChanged && state.renderTheme === renderTheme) return
    state.renderEditor = editor
    state.renderTheme = renderTheme
    editor.setTheme(renderTheme === 'dark' ? 'dark' : 'classic', renderTheme)

    // Rendered diagrams bake their palette into canvas or SVG output, so rebuild
    // them only when the actual document surface changes between light and dark.
    var diagramSelector = '.language-mermaid, .language-flowchart, .language-graphviz, .language-markmap, .language-mindmap, .language-echarts'
    if (!document.querySelector(diagramSelector)) return
    var scrollSurface = document.querySelector('.vditor-ir, .vditor-preview')
    var scrollTop = scrollSurface ? scrollSurface.scrollTop : 0
    try {
      editor.setValue(editor.getValue(), false)
      requestAnimationFrame(function () {
        if (scrollSurface) scrollSurface.scrollTop = scrollTop
      })
    } catch (error) {
      console.warn('[Markdown Editor] diagram theme refresh failed', error)
    }
  }

  function applyTheme(theme) {
    state.theme = ['default', 'pine', 'red', 'orange', 'green'].indexOf(theme) >= 0 ? theme : 'default'
    // html 也要挂主题类：html 的背景走 :root 的 --eyan-surface（VS Code 背景），
    // 不挂类的话深色 VS Code 下打开浅色主题会先闪黑
    ;[document.documentElement, document.body].forEach(function (surface) {
      surface.classList.remove('eyan-theme-pine', 'eyan-theme-red', 'eyan-theme-orange', 'eyan-theme-green')
      if (state.theme !== 'default') surface.classList.add('eyan-theme-' + state.theme)
    })
    syncVditorRenderTheme()
    enhanceContent()
    buildOutline()
    scheduleSplitSourceTools(true)
  }

  function applyVscodeTheme(theme) {
    state.vscodeDark = theme === 'dark'
    document.body.classList.toggle('eyan-vscode-dark', state.vscodeDark)
    scheduleSplitSourceTools(true)
    schedulePreviewYamlSyntax()
  }

  function applyMode(mode, attempt) {
    mode = ['preview', 'split', 'readonly'].indexOf(mode) >= 0 ? mode : 'preview'
    if (yamlMarkerEdit) commitYamlMarkerEdit()
    state.mode = mode
    if (state.mode !== 'preview') {
      clearTableRangeSelection()
      clearTableSelectorLayer()
    }
    hideLinkTooltip()
    hideGraphicToolbar()
    hideContextMenus()
    closeMermaidLabelEditor(false)
    var editor = getEditor()
    if (!editor) {
      if ((attempt || 0) < 150) setTimeout(function () { applyMode(mode, (attempt || 0) + 1) }, 100)
      return
    }
    document.body.classList.toggle('eyan-mode-readonly', state.mode === 'readonly')
    document.body.classList.toggle('eyan-mode-split', state.mode === 'split')
    if (state.mode !== 'split') {
      if (splitDivider && splitDivider.parentNode) splitDivider.parentNode.removeChild(splitDivider)
      clearSplitSyntaxHighlights()
      clearSplitSameTextHighlights()
    }
    if (menu) menu.style.display = 'none'
    if (handle) handle.style.display = 'none'
    try {
      if (state.mode === 'split') {
        ensureTableBreakGetValue()
        ensureSplitHorizontalRuleGetValue(editor)
        ensureSplitHorizontalRuleInput(editor)
        ensureSplitTaskTracking(editor)
        var splitMarkdown = markdownValueBridge && markdownValueBridge.source !== null
          ? normalizedMarkdownText(markdownValueBridge.source)
          : editor.getValue()
        splitSetextRuns = splitDashRuns(splitMarkdown)
        splitHorizontalRuleEntries = horizontalRuleSourceEntries(splitMarkdown)
        lastSplitInputAt = Date.now()
        if (!switchVditorMode(editor, 'sv')) throw new Error('Split mode control is unavailable')
        if (hasTableBreakToken(splitMarkdown)) editor.setValue(splitMarkdown, false)
        editor.enable()
      } else {
        splitHorizontalRuleEntries = null
        clearTimeout(splitHorizontalRuleRestoreTimer)
        splitHorizontalRuleRestoreTimer = null
        if (!switchVditorMode(editor, 'ir')) throw new Error('Preview mode control is unavailable')
        if (state.mode === 'readonly') {
          if (typeof editor.blur === 'function') editor.blur()
          clearInlineEditingState()
          editor.disabled()
        } else editor.enable()
      }
    } catch (error) {
      console.warn('[Markdown Editor] mode switch failed', error)
    }
    setTimeout(function () {
      enhanceContent()
      if (state.mode === 'split') restoreSplitHorizontalRuleSurface()
      if (state.mode === 'split' && normalizeSplitSetextUnderlines()) scheduleSplitSourceTools(true)
      guardReadonlySurface()
      bindSplitScrollSync()
      buildOutline()
    }, 120)
  }

  function copyButtonSvg(copied) {
    return copied
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"></rect><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-10A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17H8"></path></svg>'
  }

  function copyText(value, button) {
    var done = function () {
      var previous = button.innerHTML
      button.classList.add('eyan-copied')
      button.innerHTML = copyButtonSvg(true)
      setTimeout(function () { button.innerHTML = previous }, 1100)
      setTimeout(function () { button.classList.remove('eyan-copied') }, 1100)
    }
    var fallback = function () {
      var textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      var copied = document.execCommand('copy')
      textarea.remove()
      if (copied) done()
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done, fallback)
    } else {
      fallback()
    }
  }

  function addCopyButtons() {
    document.querySelectorAll('.vditor-reset pre:not(.vditor-ir__marker--pre)').forEach(function (pre) {
      if (pre.closest('[data-type="code-block"]')) return
      if (!pre.querySelector(':scope > .eyan-code-language')) {
        var codeNode = pre.querySelector(':scope > code')
        var language = codeNode && Array.from(codeNode.classList).map(function (name) {
          return name.indexOf('language-') === 0 ? name.slice(9) : ''
        }).find(Boolean)
        var languageLabel = document.createElement('span')
        languageLabel.className = 'eyan-code-language'
        languageLabel.textContent = language === 'yml' ? 'yaml' : (language === 'plaintext' ? 'text' : (language || 'text'))
        pre.insertBefore(languageLabel, pre.firstChild)
      }
      if (pre.querySelector('.vditor-copy, :scope > .eyan-copy-button')) return
      var button = document.createElement('button')
      button.className = 'eyan-copy-button'
      button.type = 'button'
      button.title = 'Copy code'
      button.setAttribute('aria-label', 'Copy code')
      button.innerHTML = copyButtonSvg(false)
      button.addEventListener('click', function (event) {
        event.preventDefault(); event.stopPropagation()
        var code = pre.querySelector('code')
        copyText((code || pre).textContent || '', button)
      })
      pre.appendChild(button)
    })
    document.querySelectorAll('code.language-mermaid').forEach(function (code) {
      if (code.closest('[data-type="code-block"]')) return
      var block = code.closest('.vditor-ir__node, .vditor-wysiwyg__block, [data-type="code-block"]') || code.parentElement
      var container = block.querySelector('.vditor-ir__preview, .vditor-wysiwyg__preview, .mermaid')
      if (!container || container.querySelector(':scope > .eyan-copy-button')) return
      var source = code.textContent || ''
      if (!source.trim()) return
      var button = document.createElement('button')
      button.className = 'eyan-copy-button'
      button.type = 'button'
      button.title = 'Copy Mermaid source'
      button.setAttribute('aria-label', 'Copy Mermaid source')
      button.innerHTML = copyButtonSvg(false)
      button.addEventListener('click', function (event) {
        event.preventDefault(); event.stopPropagation()
        copyText(source, button)
      })
      container.appendChild(button)
    })
    document.querySelectorAll('.mermaid[data-content], [data-type="mermaid"][data-content]').forEach(function (container) {
      if (container.querySelector(':scope > .eyan-copy-button')) return
      var source = container.getAttribute('data-content') || ''
      if (!source.trim()) return
      var button = document.createElement('button')
      button.className = 'eyan-copy-button'
      button.type = 'button'
      button.title = 'Copy Mermaid source'
      button.setAttribute('aria-label', 'Copy Mermaid source')
      button.innerHTML = copyButtonSvg(false)
      button.addEventListener('click', function (event) {
        event.preventDefault(); event.stopPropagation()
        copyText(source, button)
      })
      container.appendChild(button)
    })
  }

  function ensureCodeBlockCopyButton(block) {
    var button = block.querySelector(':scope > .eyan-code-copy-button')
    if (button) return
    button = document.createElement('button')
    button.className = 'eyan-copy-button eyan-code-copy-button'
    button.type = 'button'
    button.contentEditable = 'false'
    button.setAttribute('data-render', '1')
    button.title = 'Copy code'
    button.setAttribute('aria-label', 'Copy code')
    button.innerHTML = copyButtonSvg(false)
    button.addEventListener('mousedown', function (event) {
      event.preventDefault()
      event.stopPropagation()
    })
    button.addEventListener('click', function (event) {
      event.preventDefault()
      event.stopPropagation()
      var source = block.querySelector('.vditor-ir__marker--pre code')
      var preview = block.querySelector('.vditor-ir__preview code, .vditor-ir__preview')
      copyText(((source || preview) && (source || preview).textContent) || '', button)
    })
    block.appendChild(button)
  }

  function detectCodeLanguage(code) {
    if (!code) return 'text'
    if (window.hljs && typeof window.hljs.highlightAuto === 'function') {
      try {
        var result = window.hljs.highlightAuto(code)
        var lang = result && result.language
        var relevance = result && result.relevance
        if (lang && relevance >= 3) return lang === 'plaintext' ? 'text' : lang
      } catch (e) {}
    }
    var trimmed = String(code).trim()
    if (/^[\[{]/.test(trimmed)) {
      try { JSON.parse(trimmed); return 'json' } catch (e) {}
    }
    if (/^<\?xml|^<!DOCTYPE|^<html\b/i.test(trimmed)) return 'html'
    var keyValLines = trimmed.split('\n').filter(function (l) { return /^[\w.-]+\s*:(\s|$)/.test(l) })
    if (keyValLines.length >= 2) return 'yaml'
    if (/^#{1,6}\s|\n#{1,6}\s|^\s*[-*+]\s|\n\s*[-*+]\s|^\s*\|.*\|/m.test(trimmed)) return 'markdown'
    return 'text'
  }

  function enhanceCodeBlocks() {
    document.querySelectorAll('.vditor-ir [data-type="code-block"]').forEach(function (block) {
      var source = block.querySelector('.vditor-ir__marker--pre code')
      var preview = block.querySelector('.vditor-ir__preview')
      if (!source || !preview) return
      var info = block.querySelector('[data-type="code-block-info"]')
      var label = ''
      if (info) {
        var rawLang = (info.textContent || '').replace(/\u200B/g, '').trim()
        label = rawLang
        if (!rawLang) label = detectCodeLanguage((source.textContent || '').trim())
        else if (rawLang.toLowerCase() === 'yml') label = 'yaml'
        if ((info.textContent || '').replace(/\u200B/g, '') !== label) info.textContent = '\u200B' + label
      }
      // \u56FE\u8868\u7C7B\u4EE3\u7801\u5757\uFF08mermaid/flowchart/graphviz/echarts\uFF09\u6298\u53E0\u6001\u53EA\u6E32\u67D3\u56FE\u8868\u672C\u8EAB\uFF0C
      // \u4E0D\u52A0\u4EE3\u7801\u5757\u8FB9\u6846\u3001\u8BED\u8A00\u8868\u5934\u3001\u590D\u5236\u6309\u94AE\u548C\u884C\u53F7\u3002
      var langLower = label.toLowerCase()
      var isDiagram = langLower === 'mermaid' || langLower === 'flowchart' || langLower === 'graphviz' || langLower === 'echarts' || langLower === 'markmap' || langLower === 'mindmap'
      block.classList.toggle('eyan-diagram-block', isDiagram)
      ensureCodeBlockCopyButton(block)
      if (isDiagram) return
      var lineCount = Math.max(1, (source.textContent || '').replace(/\n$/, '').split('\n').length)
      var gutter = preview.querySelector(':scope > .eyan-code-line-numbers')
      if (!gutter) {
        gutter = document.createElement('span')
        gutter.className = 'eyan-code-line-numbers'
        gutter.setAttribute('aria-hidden', 'true')
        preview.appendChild(gutter)
      }
      var signature = String(lineCount)
      if (gutter.dataset.lines === signature) return
      gutter.dataset.lines = signature
      gutter.innerHTML = Array.from({ length: lineCount }, function (_, index) {
        return '<span>' + (index + 1) + '</span>'
      }).join('')
    })
  }

  var GRAPHIC_DIAGRAM_SELECTOR = '.language-mermaid, .language-flowchart, .language-graphviz, .language-echarts, .language-markmap, .language-mindmap, [data-type="mermaid"], .mermaid'

  function isRenderedDiagram(diagram) {
    // The source <code> and rendered preview share the same language class.
    // Only the preview is a graphic; source must inherit the editor's editability.
    return !!(diagram && !diagram.closest('.vditor-ir__marker--pre') && diagram.closest('.vditor-ir__preview, .vditor-preview .vditor-reset'))
  }

  function renderedGraphicAt(target) {
    var element = target && (target.nodeType === 1 ? target : target.parentElement)
    if (!element || element.closest('#eyan-graphic-toolbar, #eyan-graphic-fullscreen-stage, #eyan-mermaid-label-editor')) return null
    var surfaces = getRenderedTableSurfaces()
    var surface = surfaces.map(function (entry) { return entry.root }).find(function (root) { return root && root.contains(element) })
    if (!surface) return null
    var diagram = element.closest(GRAPHIC_DIAGRAM_SELECTOR)
    if (isRenderedDiagram(diagram) && surface.contains(diagram)) {
      var codeBlock = diagram.closest('[data-type="code-block"]')
      return { target: diagram, visual: diagram, codeBlock: codeBlock, type: 'diagram' }
    }
    var image = element.closest('img')
    if (image && surface.contains(image)) return { target: image, visual: image, codeBlock: null, type: 'image' }
    return null
  }

  function isGraphicEditing(graphic) {
    return !!(graphic && graphic.codeBlock && graphic.codeBlock.classList.contains('vditor-ir__node--expand'))
  }

  function graphicActionSvg(action) {
    if (action === 'edit') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l10.6-10.6-4-4L4 16Z"></path><path d="m13.5 6.5 4 4"></path></svg>'
    if (action === 'close') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>'
    if (action === 'zoom-out') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M6.8 10.5h7.4M15.3 15.3 21 21"></path></svg>'
    if (action === 'zoom-in') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M6.8 10.5h7.4M10.5 6.8v7.4M15.3 15.3 21 21"></path></svg>'
    if (action === 'fit') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"></path></svg>'
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path></svg>'
  }

  function graphicPreviewPayload(graphic) {
    if (!graphic || !graphic.visual) return null
    var visual = graphic.visual
    var image = visual.tagName === 'IMG' ? visual : visual.querySelector && visual.querySelector('img')
    if (image && image.src) return { kind: 'image', src: image.src, alt: image.alt || 'Graphic preview' }
    var canvas = visual.tagName === 'CANVAS' ? visual : visual.querySelector && visual.querySelector('canvas')
    if (canvas) {
      try { return { kind: 'image', src: canvas.toDataURL('image/png'), alt: 'Chart preview' } } catch (_) {}
    }
    var svg = visual.tagName && visual.tagName.toLowerCase() === 'svg' ? visual : visual.querySelector && visual.querySelector('svg')
    if (svg) {
      var copy = svg.cloneNode(true)
      if (!copy.getAttribute('xmlns')) copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      var serialized = new XMLSerializer().serializeToString(copy)
      return { kind: 'image', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized), alt: 'Diagram preview' }
    }
    return null
  }

  function cloneGraphicForFullscreen(graphic) {
    var visual = graphic.visual
    var image = visual.tagName === 'IMG' ? visual : visual.querySelector && visual.querySelector('img')
    if (image && image.src) {
      var picture = document.createElement('img')
      picture.src = image.src
      picture.alt = image.alt || 'Graphic preview'
      return picture
    }
    // Vector diagrams must stay vectors. Serializing them into an <img> bakes a
    // single raster at the snapshot size, which the stage can only blur when it
    // scales up, and Mermaid's width="100%" makes that size wrong as well.
    var svg = visual.tagName && visual.tagName.toLowerCase() === 'svg' ? visual : visual.querySelector && visual.querySelector('svg')
    if (svg) {
      var rect = svg.getBoundingClientRect()
      var viewBox = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
      var boxed = viewBox.length === 4 && viewBox.every(function (value) { return Number.isFinite(value) })
      var width = rect.width || (boxed ? viewBox[2] : 0)
      var height = rect.height || (boxed ? viewBox[3] : 0)
      var vector = svg.cloneNode(true)
      if (width && height) {
        vector.setAttribute('width', width)
        vector.setAttribute('height', height)
        // The rendered SVG carries an inline max-width that outranks the stage
        // stylesheet, so the explicit size has to be inline as well.
        vector.style.maxWidth = 'none'
        vector.style.maxHeight = 'none'
        vector.style.width = width + 'px'
        vector.style.height = height + 'px'
      }
      return vector
    }
    // Canvas charts have no vector source. Re-export them above display
    // resolution so zooming in still has detail to reveal.
    var canvas = visual.tagName === 'CANVAS' ? visual : visual.querySelector && visual.querySelector('canvas')
    if (canvas) {
      var chart = window.echarts && typeof window.echarts.getInstanceByDom === 'function' ? window.echarts.getInstanceByDom(visual) : null
      var ratio = Math.max(2, Math.min(4, (window.devicePixelRatio || 1) * 2))
      var source = null
      if (chart && typeof chart.getDataURL === 'function') {
        try { source = chart.getDataURL({ type: 'png', pixelRatio: ratio, backgroundColor: getComputedStyle(visual).backgroundColor }) } catch (_) {}
      }
      if (!source) {
        try { source = canvas.toDataURL('image/png') } catch (_) {}
      }
      if (source) {
        var chartImage = document.createElement('img')
        chartImage.src = source
        chartImage.alt = 'Chart preview'
        var chartWidth = canvas.clientWidth || canvas.width
        var chartHeight = canvas.clientHeight || canvas.height
        if (chartWidth && chartHeight) {
          chartImage.style.width = chartWidth + 'px'
          chartImage.style.height = chartHeight + 'px'
        }
        return chartImage
      }
    }
    var clone = visual.cloneNode(true)
    clone.querySelectorAll('.eyan-copy-button, .eyan-graphic-toolbar').forEach(function (node) { node.remove() })
    return clone
  }

  function cleanupGraphicFullscreen() {
    if (!graphicFullscreenStage) return
    var stage = graphicFullscreenStage
    graphicFullscreenStage = null
    graphicFullscreenView = null
    if (stage.parentNode) stage.parentNode.removeChild(stage)
    scheduleRenderedChartResize()
  }

  function requestGraphicPreviewFallback(graphic) {
    var payload = graphicPreviewPayload(graphic)
    if (!payload || !window.vscode || typeof window.vscode.postMessage !== 'function') return
    window.vscode.postMessage({ command: 'open-graphic-preview', preview: payload })
  }

  function applyGraphicFullscreenTransform() {
    if (!graphicFullscreenView) return
    var view = graphicFullscreenView
    view.canvas.style.transform = 'translate(-50%, -50%) translate(' + view.offsetX + 'px, ' + view.offsetY + 'px) scale(' + view.scale + ')'
    view.percentage.textContent = Math.round(view.scale * 100) + '%'
    view.viewport.classList.toggle('eyan-can-pan', view.width * view.scale > view.viewport.clientWidth || view.height * view.scale > view.viewport.clientHeight)
  }

  function setGraphicFullscreenScale(nextScale, clientX, clientY) {
    if (!graphicFullscreenView) return
    var view = graphicFullscreenView
    var oldScale = view.scale || 1
    var next = Math.max(0.05, Math.min(16, nextScale))
    var rect = view.viewport.getBoundingClientRect()
    var anchorX = Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2
    var anchorY = Number.isFinite(clientY) ? clientY : rect.top + rect.height / 2
    var centerX = rect.left + rect.width / 2
    var centerY = rect.top + rect.height / 2
    var localX = (anchorX - centerX - view.offsetX) / oldScale
    var localY = (anchorY - centerY - view.offsetY) / oldScale
    view.offsetX = anchorX - centerX - localX * next
    view.offsetY = anchorY - centerY - localY * next
    view.scale = next
    applyGraphicFullscreenTransform()
  }

  function measureGraphicFullscreenNode(node) {
    // An explicit inline size is the intended 100% basis: high-resolution chart
    // exports are deliberately larger than the size they should present at.
    var styled = { width: parseFloat(node.style.width), height: parseFloat(node.style.height) }
    if (styled.width > 0 && styled.height > 0) return styled
    if (node.tagName === 'IMG' && node.naturalWidth) return { width: node.naturalWidth, height: node.naturalHeight }
    var rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  function fitGraphicFullscreen() {
    if (!graphicFullscreenView) return
    var view = graphicFullscreenView
    var measured = measureGraphicFullscreenNode(view.node)
    var width = measured.width
    var height = measured.height
    if (!width || !height) return
    view.width = width
    view.height = height
    view.node.style.width = width + 'px'
    view.node.style.height = height + 'px'
    view.offsetX = 0
    view.offsetY = 0
    view.scale = Math.max(0.05, Math.min(16, Math.min((view.viewport.clientWidth - 32) / width, (view.viewport.clientHeight - 32) / height)))
    applyGraphicFullscreenTransform()
  }

  function resetGraphicFullscreenScale() {
    if (!graphicFullscreenView) return
    graphicFullscreenView.offsetX = 0
    graphicFullscreenView.offsetY = 0
    graphicFullscreenView.scale = 1
    applyGraphicFullscreenTransform()
  }

  function closeGraphicFullscreen() {
    var stage = graphicFullscreenStage
    if (!stage) return
    if (document.fullscreenElement === stage && document.exitFullscreen) {
      Promise.resolve(document.exitFullscreen()).catch(cleanupGraphicFullscreen)
    } else cleanupGraphicFullscreen()
  }

  function openGraphicFullscreen(graphic) {
    if (!graphic || !graphic.visual) return
    hideGraphicToolbar()
    cleanupGraphicFullscreen()
    var stage = document.createElement('div')
    stage.id = 'eyan-graphic-fullscreen-stage'
    stage.innerHTML =
      '<button type="button" class="eyan-graphic-close" title="Close" aria-label="Close">' + graphicActionSvg('close') + '</button>' +
      '<div class="eyan-graphic-fullscreen-content"><div class="eyan-graphic-fullscreen-canvas"></div></div>' +
      '<div class="eyan-graphic-zoom-toolbar" role="toolbar" aria-label="Image zoom controls">' +
        '<button type="button" data-zoom-action="out" title="Zoom out" aria-label="Zoom out">' + graphicActionSvg('zoom-out') + '</button>' +
        '<button type="button" class="eyan-graphic-zoom-percentage" data-zoom-action="reset" title="Reset to 100%" aria-label="Reset to 100%">100%</button>' +
        '<button type="button" data-zoom-action="in" title="Zoom in" aria-label="Zoom in">' + graphicActionSvg('zoom-in') + '</button>' +
        '<span class="eyan-control-divider"></span>' +
        '<button type="button" data-zoom-action="fit" title="Fit to window" aria-label="Fit to window">' + graphicActionSvg('fit') + '<span>Fit</span></button>' +
      '</div>'
    var viewport = stage.querySelector('.eyan-graphic-fullscreen-content')
    var canvas = stage.querySelector('.eyan-graphic-fullscreen-canvas')
    var node = cloneGraphicForFullscreen(graphic)
    canvas.appendChild(node)
    stage.querySelector('.eyan-graphic-close').addEventListener('click', function (event) {
      event.preventDefault()
      event.stopPropagation()
      closeGraphicFullscreen()
    })
    document.body.appendChild(stage)
    graphicFullscreenStage = stage
    graphicFullscreenView = {
      viewport: viewport,
      canvas: canvas,
      node: node,
      percentage: stage.querySelector('.eyan-graphic-zoom-percentage'),
      width: 1,
      height: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      drag: null
    }
    stage.querySelector('.eyan-graphic-zoom-toolbar').addEventListener('click', function (event) {
      var button = event.target.closest('[data-zoom-action]')
      if (!button || !graphicFullscreenView) return
      event.preventDefault()
      event.stopPropagation()
      if (button.dataset.zoomAction === 'out') setGraphicFullscreenScale(graphicFullscreenView.scale / 1.2)
      else if (button.dataset.zoomAction === 'in') setGraphicFullscreenScale(graphicFullscreenView.scale * 1.2)
      else if (button.dataset.zoomAction === 'reset') resetGraphicFullscreenScale()
      else fitGraphicFullscreen()
    })
    viewport.addEventListener('wheel', function (event) {
      if (!graphicFullscreenView) return
      event.preventDefault()
      var factor = Math.exp(-event.deltaY * 0.0015)
      setGraphicFullscreenScale(graphicFullscreenView.scale * factor, event.clientX, event.clientY)
    }, { passive: false })
    viewport.addEventListener('pointerdown', function (event) {
      if (!graphicFullscreenView || event.button !== 0) return
      if (event.target.closest && event.target.closest('button')) return
      event.preventDefault()
      graphicFullscreenView.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: graphicFullscreenView.offsetX, offsetY: graphicFullscreenView.offsetY }
      viewport.classList.add('eyan-panning')
      if (viewport.setPointerCapture) {
        try { viewport.setPointerCapture(event.pointerId) } catch (_) {}
      }
    })
    viewport.addEventListener('pointermove', function (event) {
      var view = graphicFullscreenView
      if (!view || !view.drag || view.drag.pointerId !== event.pointerId) return
      view.offsetX = view.drag.offsetX + event.clientX - view.drag.x
      view.offsetY = view.drag.offsetY + event.clientY - view.drag.y
      applyGraphicFullscreenTransform()
    })
    function stopPanning(event) {
      var view = graphicFullscreenView
      if (!view || !view.drag || (event.pointerId != null && view.drag.pointerId !== event.pointerId)) return
      view.drag = null
      viewport.classList.remove('eyan-panning')
    }
    viewport.addEventListener('pointerup', stopPanning)
    viewport.addEventListener('pointercancel', stopPanning)
    viewport.addEventListener('lostpointercapture', stopPanning)
    var initializeFit = function () { requestAnimationFrame(fitGraphicFullscreen) }
    if (node.tagName === 'IMG' && !node.complete) node.addEventListener('load', initializeFit, { once: true })
    else initializeFit()
    if (stage.requestFullscreen) {
      Promise.resolve(stage.requestFullscreen()).then(function () {
        fitGraphicFullscreen()
        scheduleRenderedChartResize()
      }).catch(function () {
        stage.dataset.fullscreenFallback = '1'
        fitGraphicFullscreen()
      })
    } else {
      stage.dataset.fullscreenFallback = '1'
      fitGraphicFullscreen()
    }
  }

  function editGraphicBlock(graphic) {
    if (state.mode !== 'preview' || !graphic) return
    if (graphic.type === 'diagram') {
      var block = graphic.codeBlock || graphic.visual.closest('[data-type="code-block"]')
      if (!block) return
      block.classList.add('vditor-ir__node--expand')
      var source = block.querySelector('.vditor-ir__marker--pre code')
      if (source) source.focus()
      hideGraphicToolbar()
      return
    }
    var editable = graphic.visual.closest('[data-type="img"]') || graphic.visual
    if (editable.focus) editable.focus()
    graphicEditDispatching = true
    try {
      graphic.visual.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    } finally {
      graphicEditDispatching = false
    }
    hideGraphicToolbar()
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function mermaidNodeIdentity(target, graphic) {
    if (!graphic || graphic.type !== 'diagram' || !graphic.visual) return null
    var className = String(graphic.visual.className && graphic.visual.className.baseVal || graphic.visual.className || '')
    var dataType = String(graphic.visual.getAttribute && graphic.visual.getAttribute('data-type') || '')
    if (!/(^|\s)(language-)?mermaid(\s|$)/i.test(className) && dataType.toLowerCase() !== 'mermaid') return null
    var element = target && (target.nodeType === 1 ? target : target.parentElement)
    if (!element || !element.closest('text, tspan, foreignObject, .nodeLabel, .label')) return null
    var node = element.closest('.node, [data-id]')
    if (!node || !graphic.visual.contains(node)) return null
    var id = node.getAttribute('data-id') || node.getAttribute('data-node') || ''
    if (!id) {
      var renderedId = node.id || ''
      var match = renderedId.match(/^flowchart-(.+?)-\d+$/)
      if (match) id = match[1]
    }
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)) return null
    return { id: id, node: node, labelElement: element.closest('text, tspan, foreignObject, .nodeLabel, .label') }
  }

  function findMermaidNodeLabelMatch(source, id) {
    var matches = []
    var expression = new RegExp('(^|[^A-Za-z0-9_-])(' + escapeRegExp(id) + ')(?=\\s*(?:\\[\\[|\\(\\(|\\{\\{|[\\[\\(\\{>]))', 'gm')
    var result
    var pairs = [
      { open: '[[', close: ']]' },
      { open: '((', close: '))' },
      { open: '{{', close: '}}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '{', close: '}' },
      { open: '>', close: ']' }
    ]
    while ((result = expression.exec(source))) {
      var cursor = result.index + result[1].length + result[2].length
      while (/\s/.test(source[cursor] || '')) cursor += 1
      var pair = pairs.find(function (candidate) { return source.slice(cursor, cursor + candidate.open.length) === candidate.open })
      if (!pair) continue
      var labelStart = cursor + pair.open.length
      var labelEnd = source.indexOf(pair.close, labelStart)
      if (labelEnd < 0 || source.slice(labelStart, labelEnd).indexOf('\n') >= 0) continue
      var raw = source.slice(labelStart, labelEnd)
      var quote = ''
      var value = raw
      if (raw.length >= 2 && (raw[0] === '"' || raw[0] === "'") && raw[raw.length - 1] === raw[0]) {
        quote = raw[0]
        value = raw.slice(1, -1)
      }
      if (!value.trim() || /[<>`\n\r]/.test(value)) continue
      matches.push({ start: labelStart, end: labelEnd, value: value, quote: quote, raw: raw })
    }
    return matches.length === 1 ? matches[0] : null
  }

  function closeMermaidLabelEditor(commit) {
    if (!mermaidLabelEditor) return
    var session = mermaidLabelEditor
    mermaidLabelEditor = null
    var input = session.input
    if (commit && input && input.value !== session.match.value) {
      var value = input.value.replace(/[\r\n]+/g, ' ').trim()
      var current = session.source.textContent || ''
      var liveMatch = findMermaidNodeLabelMatch(current, session.id)
      if (value && liveMatch && liveMatch.raw === session.match.raw) {
        var replacement = liveMatch.quote ? liveMatch.quote + value.replace(new RegExp(liveMatch.quote, 'g'), '\\' + liveMatch.quote) + liveMatch.quote : value
        session.source.textContent = current.slice(0, liveMatch.start) + replacement + current.slice(liveMatch.end)
        session.source.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
      }
    }
    if (input && input.parentNode) input.parentNode.removeChild(input)
    hideGraphicToolbar()
  }

  function openMermaidLabelEditor(event, graphic) {
    if (state.mode !== 'preview') return false
    var identity = mermaidNodeIdentity(event.target, graphic)
    if (!identity) return false
    var block = graphic.codeBlock || graphic.visual.closest('[data-type="code-block"]')
    var source = block && block.querySelector('.vditor-ir__marker--pre code')
    if (!source) return false
    var match = findMermaidNodeLabelMatch(source.textContent || '', identity.id)
    if (!match) return false
    closeMermaidLabelEditor(false)
    var rect = identity.labelElement.getBoundingClientRect()
    var input = document.createElement('input')
    input.id = 'eyan-mermaid-label-editor'
    input.type = 'text'
    input.value = match.value
    input.setAttribute('aria-label', 'Edit Mermaid node label')
    input.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(120, rect.width + 28) - 8)) + 'px'
    input.style.top = Math.max(8, Math.min(rect.top, window.innerHeight - Math.max(32, rect.height + 12) - 8)) + 'px'
    input.style.width = Math.max(120, rect.width + 28) + 'px'
    input.style.height = Math.max(32, rect.height + 12) + 'px'
    mermaidLabelEditor = { input: input, source: source, id: identity.id, match: match }
    input.addEventListener('keydown', function (keyboardEvent) {
      if (keyboardEvent.key === 'Enter') {
        keyboardEvent.preventDefault()
        closeMermaidLabelEditor(true)
      } else if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault()
        closeMermaidLabelEditor(false)
      }
    })
    input.addEventListener('blur', function () {
      if (mermaidLabelEditor && mermaidLabelEditor.input === input) closeMermaidLabelEditor(true)
    })
    document.body.appendChild(input)
    input.focus()
    input.select()
    hideGraphicToolbar()
    return true
  }

  function ensureGraphicToolbar() {
    if (graphicToolbar) return graphicToolbar
    var toolbar = document.createElement('div')
    toolbar.id = 'eyan-graphic-toolbar'
    toolbar.setAttribute('aria-hidden', 'true')
    toolbar.innerHTML = '<button type="button" data-graphic-action="edit" title="Edit" aria-label="Edit">' + graphicActionSvg('edit') + '</button>'
    document.body.appendChild(toolbar)
    graphicToolbar = toolbar
    toolbar.addEventListener('mouseenter', function () { clearTimeout(graphicToolbarHideTimer) })
    toolbar.addEventListener('mouseleave', scheduleHideGraphicToolbar)
    toolbar.addEventListener('mousedown', function (event) { event.preventDefault() })
    toolbar.addEventListener('click', function (event) {
      var button = event.target.closest('[data-graphic-action]')
      if (!button || !activeGraphicBlock) return
      event.preventDefault()
      event.stopPropagation()
      if (button.dataset.graphicAction === 'edit') editGraphicBlock(activeGraphicBlock)
    })
    return toolbar
  }

  function positionGraphicToolbar() {
    if (!graphicToolbar || !graphicToolbar.classList.contains('eyan-visible') || !activeGraphicBlock || !activeGraphicBlock.target.isConnected) return
    var rect = activeGraphicBlock.target.getBoundingClientRect()
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) {
      hideGraphicToolbar()
      return
    }
    var toolbarRect = graphicToolbar.getBoundingClientRect()
    var edge = 8
    var left = Math.max(edge, Math.min(rect.right - toolbarRect.width - 8, window.innerWidth - toolbarRect.width - edge))
    var top = Math.max(edge, Math.min(rect.top + 8, window.innerHeight - toolbarRect.height - edge))
    graphicToolbar.style.left = left + 'px'
    graphicToolbar.style.top = top + 'px'
  }

  function showGraphicToolbar(graphic) {
    if (state.mode !== 'preview' || !graphic || !graphic.target || isGraphicEditing(graphic) || graphic.target.closest('#eyan-graphic-fullscreen-stage')) {
      if (isGraphicEditing(graphic)) hideGraphicToolbar()
      return
    }
    clearTimeout(graphicToolbarHideTimer)
    if (activeGraphicBlock && activeGraphicBlock.target !== graphic.target) activeGraphicBlock.target.classList.remove('eyan-graphic-selected')
    activeGraphicBlock = graphic
    activeGraphicBlock.target.classList.add('eyan-graphic-selected')
    var toolbar = ensureGraphicToolbar()
    toolbar.classList.add('eyan-visible')
    toolbar.setAttribute('aria-hidden', 'false')
    positionGraphicToolbar()
  }

  function hideGraphicToolbar() {
    clearTimeout(graphicToolbarHideTimer)
    if (activeGraphicBlock && activeGraphicBlock.target) activeGraphicBlock.target.classList.remove('eyan-graphic-selected')
    if (graphicToolbar) {
      graphicToolbar.classList.remove('eyan-visible')
      graphicToolbar.setAttribute('aria-hidden', 'true')
    }
    activeGraphicBlock = null
  }

  function scheduleHideGraphicToolbar() {
    clearTimeout(graphicToolbarHideTimer)
    graphicToolbarHideTimer = setTimeout(function () {
      if (graphicToolbar && graphicToolbar.matches(':hover')) return
      var pointerGraphic = graphicAtCurrentPointer()
      if (pointerGraphic && activeGraphicBlock && pointerGraphic.target === activeGraphicBlock.target) return
      hideGraphicToolbar()
    }, 120)
  }

  function graphicAtCurrentPointer() {
    if (graphicPointerX < 0 || graphicPointerY < 0) return null
    var target = document.elementFromPoint(graphicPointerX, graphicPointerY)
    return target ? renderedGraphicAt(target) : null
  }

  function protectRenderedGraphics() {
    document.querySelectorAll(GRAPHIC_DIAGRAM_SELECTOR).forEach(function (diagram) {
      if (diagram.closest('#eyan-graphic-fullscreen-stage')) return
      if (!isRenderedDiagram(diagram)) {
        if (diagram.classList.contains('eyan-rendered-graphic-readonly')) {
          diagram.removeAttribute('contenteditable')
          diagram.removeAttribute('spellcheck')
          diagram.classList.remove('eyan-rendered-graphic-readonly')
        }
        return
      }
      diagram.setAttribute('contenteditable', 'false')
      diagram.setAttribute('spellcheck', 'false')
      diagram.classList.add('eyan-rendered-graphic-readonly')
    })
  }

  function bindGraphicTools() {
    if (graphicListenersBound) return
    graphicListenersBound = true
    document.addEventListener('mousemove', function (event) {
      graphicPointerX = event.clientX
      graphicPointerY = event.clientY
    }, true)
    document.addEventListener('click', function (event) {
      if (graphicEditDispatching) return
      if ((graphicToolbar && graphicToolbar.contains(event.target)) || (graphicFullscreenStage && graphicFullscreenStage.contains(event.target))) return
      var graphic = renderedGraphicAt(event.target)
      if (!graphic) {
        hideGraphicToolbar()
        return
      }
      if (isGraphicEditing(graphic)) {
        hideGraphicToolbar()
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      hideGraphicToolbar()
      openGraphicFullscreen(graphic)
    }, true)
    document.addEventListener('mouseover', function (event) {
      if (state.mode !== 'preview') return
      var graphic = renderedGraphicAt(event.target)
      if (graphic) showGraphicToolbar(graphic)
    }, true)
    document.addEventListener('mouseout', function (event) {
      if (!activeGraphicBlock || !activeGraphicBlock.target) return
      var next = event.relatedTarget
      if (next && (activeGraphicBlock.target.contains(next) || (graphicToolbar && graphicToolbar.contains(next)))) return
      scheduleHideGraphicToolbar()
    }, true)
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return
      if (graphicFullscreenStage && document.fullscreenElement !== graphicFullscreenStage) {
        event.preventDefault()
        cleanupGraphicFullscreen()
        return
      }
      if (activeGraphicBlock) hideGraphicToolbar()
    }, true)
    document.addEventListener('fullscreenchange', function () {
      if (graphicFullscreenStage && document.fullscreenElement !== graphicFullscreenStage) cleanupGraphicFullscreen()
    })
    document.addEventListener('scroll', function () {
      closeMermaidLabelEditor(false)
      var hoveredGraphic = activeGraphicBlock
      hideGraphicToolbar()
      requestAnimationFrame(function () {
        var pointerGraphic = graphicAtCurrentPointer()
        if (state.mode === 'preview' && pointerGraphic) showGraphicToolbar(pointerGraphic)
        else if (state.mode === 'preview' && hoveredGraphic && hoveredGraphic.target && hoveredGraphic.target.isConnected && hoveredGraphic.target.matches(':hover')) showGraphicToolbar(hoveredGraphic)
      })
    }, true)
    window.addEventListener('resize', function () {
      if (graphicFullscreenStage) fitGraphicFullscreen()
      else positionGraphicToolbar()
    })
  }

  function escapeYamlHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function yamlHighlightHTML(text) {
    // Keep the key and its colon distinct from the value in every mode.
    var html = []
    String(text).split('\n').forEach(function (line) {
      var idx = line.indexOf(':')
      if (idx > 0) {
        html.push('<span class="eyan-yaml-key">' + escapeYamlHtml(line.slice(0, idx + 1)) + '</span>' + escapeYamlHtml(line.slice(idx + 1)))
      } else {
        html.push(escapeYamlHtml(line))
      }
    })
    return html.join('\n')
  }

  function ensureYamlOverlayLayer() {
    var ir = document.querySelector('.vditor-ir')
    if (!ir) return null
    var layer = ir.querySelector(':scope > #eyan-yaml-overlay-layer')
    if (!layer) {
      layer = document.createElement('div')
      layer.id = 'eyan-yaml-overlay-layer'
      ir.appendChild(layer)
    }
    return layer
  }

  function positionYamlOverlays(updateContent) {
    positionYamlMarkerEditInput()
    if (yamlOverlayMap.size === 0) return
    var ir = document.querySelector('.vditor-ir')
    if (!ir) return
    var irRect = ir.getBoundingClientRect()
    yamlOverlayMap.forEach(function (overlay, node) {
      if (!node.isConnected) {
        overlay.remove()
        yamlOverlayMap.delete(node)
        return
      }
      var code = node.querySelector('.vditor-ir__marker--pre code')
      if (!code) return
      var editing = node.classList.contains('eyan-yaml-editing')
      if (editing) {
        overlay.style.display = 'none'
        return
      }
      if (updateContent !== false) {
        var text = code.textContent
        if (overlay.dataset.signature !== text) {
          overlay.dataset.signature = text
          overlay.innerHTML = yamlHighlightHTML(text)
        }
      }
      var r = code.getBoundingClientRect()
      overlay.style.display = 'block'
      overlay.style.top = (r.top - irRect.top) + 'px'
      overlay.style.left = (r.left - irRect.left) + 'px'
      overlay.style.width = r.width + 'px'
      overlay.style.height = r.height + 'px'
    })
  }

  function enhanceFrontMatter() {
    // GitHub 风格：顶部 YAML 始终以「卡片」展示源码（--- 标记 + 等宽字体），
    // 键值着色由 .eyan-yaml-highlight 覆盖层实现（不进入 Vditor 序列化 DOM）。
    var layer = ensureYamlOverlayLayer()
    document.querySelectorAll('.vditor-ir div[data-type="yaml-front-matter"]').forEach(function (node) {
      node.classList.add('vditor-ir__node--expand')
      if (!yamlOverlayMap.has(node)) {
        var overlay = document.createElement('div')
        overlay.className = 'eyan-yaml-highlight'
        overlay.setAttribute('aria-hidden', 'true')
        if (layer) layer.appendChild(overlay)
        yamlOverlayMap.set(node, overlay)
      }
      if (node.dataset.eyanFrontMatterBound) return
      node.dataset.eyanFrontMatterBound = '1'
      node.addEventListener('click', function (event) {
        if (state.mode === 'readonly') return
        node.classList.add('eyan-yaml-editing')
        positionYamlOverlays(false)
        schedulePreviewYamlSyntax()
        if (node.dataset.eyanYamlPointerHandled === '1') {
          delete node.dataset.eyanYamlPointerHandled
          return
        }
        var editor = getEditor()
        if (editor) editor.focus()
        var pre = node.querySelector('.vditor-ir__marker--pre')
        if (pre && !pre.contains(event.target)) {
          var range = document.createRange()
          range.selectNodeContents(pre)
          range.collapse(false)
          var selection = window.getSelection()
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      })
    })
    positionYamlOverlays()
  }

  function placeYamlCaret(node, event) {
    var code = node && node.querySelector('.vditor-ir__marker--pre code')
    if (!code) return
    var range = null
    var target = event && event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    var marker = target && target.closest && target.closest('[data-type="yaml-front-matter-open-marker"], [data-type="yaml-front-matter-close-marker"]')
    if (marker) {
      if (document.caretRangeFromPoint && event) {
        range = document.caretRangeFromPoint(event.clientX, event.clientY)
        if (!range || !marker.contains(range.startContainer)) range = null
      }
      if (!range) {
        range = document.createRange()
        range.selectNodeContents(marker)
        range.collapse(marker.getAttribute('data-type') === 'yaml-front-matter-open-marker' ? true : false)
      }
    } else if (target && target.closest && target.closest('[data-type="yaml-front-matter-open-marker"]')) {
      range = document.createRange()
      range.selectNodeContents(code)
      range.collapse(true)
    } else if (target && target.closest && target.closest('[data-type="yaml-front-matter-close-marker"]')) {
      range = document.createRange()
      range.selectNodeContents(code)
      range.collapse(false)
    } else if (document.caretRangeFromPoint && event) {
      range = document.caretRangeFromPoint(event.clientX, event.clientY)
      if (!range || !code.contains(range.startContainer)) range = null
    }
    if (!range) {
      range = document.createRange()
      range.selectNodeContents(code)
      range.collapse(false)
    }
    var selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
    if (typeof code.focus === 'function') code.focus({ preventScroll: true })
  }

  function yamlMarkerForTarget(target) {
    return target && target.closest && target.closest('[data-type="yaml-front-matter-open-marker"], [data-type="yaml-front-matter-close-marker"], .eyan-yaml-marker-input')
  }

  function yamlMarkerLineIndex(editor, marker, sourceOverride) {
    var source = sourceOverride || normalizedMarkdownText(editor && editor.getValue ? editor.getValue() : '')
    var lines = source.split('\n')
    var range = frontMatterRange(source)
    if (range) return marker.getAttribute('data-type') === 'yaml-front-matter-close-marker' ? range.close : range.open
    var first = firstNonEmptyLineIndex(lines)
    return marker.getAttribute('data-type') === 'yaml-front-matter-close-marker' ? Math.max(first + 1, lines.length - 1) : Math.max(first, 0)
  }

  // In Split mode Vditor sometimes renders the two frontmatter delimiters as
  // plain text inside a data-block instead of emitting marker spans. Detect
  // those physical lines from the pointer position so the standalone input
  // still owns the edit and Vditor cannot recreate the delimiter.
  function splitYamlMarkerAtPointer(event) {
    if (state.mode !== 'split' || !event) return null
    var target = event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    var surface = target && target.closest && target.closest('.vditor-sv')
    if (!surface) return null
    var editor = getEditor()
    var source = normalizedMarkdownText(editor && editor.getValue ? editor.getValue() : '')
    if (!source) source = nativeMarkdownValue(editor)
    var range = frontMatterRange(source)
    if (!range) return null
    var block = target.closest && target.closest('[data-block]')
    if (!block) return null
    if ((block.textContent || '').trim() !== '---') return null
    var markerBlocks = Array.from(surface.querySelectorAll('[data-block]')).filter(function (candidate) {
      return (candidate.textContent || '').trim() === '---'
    }).sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top })
    var markerIndex = markerBlocks.indexOf(block)
    if (markerIndex < 0 || markerIndex > 1) return null
    return {
      node: block,
      marker: block,
      markerType: markerIndex === 0 ? 'yaml-front-matter-open-marker' : 'yaml-front-matter-close-marker',
      lineIndex: markerIndex === 0 ? range.open : range.close,
      source: source
    }
  }

  function beginYamlMarkerEdit(node, marker, event, options) {
    options = options || {}
    var editor = getEditor()
    if (!editor || !node || !marker || state.mode === 'readonly') return false
    if (yamlMarkerEdit && yamlMarkerEdit.input === marker) return true
    if (yamlMarkerEdit && yamlMarkerEdit.input !== marker) {
      var markerTypeToResume = marker.getAttribute('data-type') || ''
      commitYamlMarkerEdit()
      var markerRoot = state.mode === 'preview' ? '.vditor-ir ' : '.vditor-sv '
      marker = document.querySelector(markerRoot + '[data-type="' + markerTypeToResume + '"]')
      node = marker && marker.closest('.vditor-ir div[data-type="yaml-front-matter"], .vditor-sv [data-block]')
      if (!marker || !node) return false
    }
    // Read through the value bridge so a leading blank line is retained. The
    // native Vditor serializer drops that blank and would promote a later
    // marker to front matter even though it is not on the physical first line.
    var source = normalizedMarkdownText(editor.getValue())
    if (!source) source = nativeMarkdownValue(editor)
    var initialRange = frontMatterRange(source)
    node.classList.add('eyan-yaml-editing')
    node.dataset.eyanYamlPointerHandled = '1'
    var input = document.createElement('input')
    input.type = 'text'
    input.className = 'eyan-yaml-marker-input'
    var markerType = options.markerType || marker.getAttribute('data-type') || ''
    input.setAttribute('data-type', markerType)
    input.value = options.value != null ? options.value : (marker.textContent || '')
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', 'YAML marker')
    var markerClass = marker.className || ''
    // Keep this input outside Vditor's editable surface. Replacing a marker
    // inside .vditor-sv lets Vditor's delayed parser rebuild the source pane,
    // which recreates `---` and moves focus to the opening marker.
    document.body.appendChild(input)
    marker.style.visibility = 'hidden'
    yamlMarkerEdit = {
      node: node,
      marker: marker,
      input: input,
      markerClass: markerClass,
      markerType: markerType,
      editor: editor,
      lineIndex: options.lineIndex != null ? options.lineIndex : yamlMarkerLineIndex(editor, marker, source),
      initialRange: initialRange,
      source: source,
      initialSource: source
    }
    // The native source remains untouched until commit. Stopping these events
    // also prevents document-level helpers from treating marker keystrokes as
    // a partial Markdown structure.
    input.addEventListener('beforeinput', function (event) {
      event.stopImmediatePropagation()
    }, true)
    input.addEventListener('keydown', function (event) {
      event.stopImmediatePropagation()
      if (event.key === 'Enter') {
        event.preventDefault()
        commitYamlMarkerEdit()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        yamlMarkerEdit.source = yamlMarkerEdit.initialSource
        commitYamlMarkerEdit()
      }
    }, true)
    input.addEventListener('input', function (event) {
      event.stopImmediatePropagation()
      updateYamlMarkerSource()
    }, true)
    // Keep getValue() on the exact pending source while the native source is
    // unchanged. This preserves blank lines and the other marker on every
    // keystroke without rebuilding the editor surface.
    setMarkdownBridgeSource(editor, source)
    positionYamlMarkerEditInput()
    input.focus({ preventScroll: true })
    var caretOffset = yamlMarkerCaretOffset(input, event)
    input.setSelectionRange(caretOffset, caretOffset)
    positionYamlOverlays(false)
    schedulePreviewYamlSyntax()
    return true
  }

  function yamlMarkerOwnsEvent(event) {
    if (!yamlMarkerEdit || !yamlMarkerEdit.input || !yamlMarkerEdit.input.isConnected) return false
    var target = event && event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    return !!(target && yamlMarkerEdit.input.contains(target))
  }

  function positionYamlMarkerEditInput() {
    if (!yamlMarkerEdit || !yamlMarkerEdit.input || !yamlMarkerEdit.marker) return
    var input = yamlMarkerEdit.input
    var marker = yamlMarkerEdit.marker
    if (!input.isConnected || !marker.isConnected) return
    var rect = marker.getBoundingClientRect()
    var split = state.mode === 'split'
    input.style.position = 'fixed'
    input.style.zIndex = '1000'
    input.style.left = Math.round(rect.left) + 'px'
    input.style.top = Math.round(rect.top) + 'px'
    input.style.width = Math.max(split ? 42 : rect.width, 42) + 'px'
    input.style.height = Math.max(rect.height, 20) + 'px'
    input.style.padding = split ? '0' : '0 20px'
    input.style.color = split ? 'var(--vscode-textLink-foreground, var(--vscode-editor-foreground))' : 'var(--eyan-code-text)'
  }

  function yamlMarkerCaretOffset(input, event) {
    if (!input || !event || typeof event.clientX !== 'number') return input ? input.value.length : 0
    var rect = input.getBoundingClientRect()
    var styles = window.getComputedStyle(input)
    var canvas = document.createElement('canvas')
    var context = canvas.getContext('2d')
    if (!context) return input.value.length
    context.font = styles.font
    var x = Math.max(0, event.clientX - rect.left - (parseFloat(styles.paddingLeft) || 0))
    for (var index = 0; index < input.value.length; index++) {
      var before = context.measureText(input.value.slice(0, index)).width
      var after = context.measureText(input.value.slice(0, index + 1)).width
      if (x < (before + after) / 2) return index
    }
    return input.value.length
  }

  function pauseYamlMarkerProcessing(editor) {
    var internal = editor && editor.vditor
    if (!internal) return
    // Cancel delayed Vditor rebuilds while the standalone marker input owns
    // the edit; those rebuilds otherwise reclaim focus in Split mode.
    if (internal.sv) {
      if (internal.sv.processTimeoutId) clearTimeout(internal.sv.processTimeoutId)
      internal.sv.processTimeoutId = 0
    }
    if (internal.preview) {
      if (internal.preview.mdTimeoutId) clearTimeout(internal.preview.mdTimeoutId)
      internal.preview.mdTimeoutId = 0
    }
    if (internal.ir && internal.ir.processTimeoutId) {
      clearTimeout(internal.ir.processTimeoutId)
      internal.ir.processTimeoutId = 0
    }
  }

  function updateYamlMarkerSource() {
    if (!yamlMarkerEdit || !yamlMarkerEdit.input || !yamlMarkerEdit.editor) return false
    // Keep the exact source snapshot from entry. Vditor's live serializer
    // drops the blank separator after frontmatter while the marker input is
    // active, which would otherwise delete user whitespace on each keystroke.
    var source = yamlMarkerEdit.source || normalizedMarkdownText(yamlMarkerEdit.editor.getValue())
    var lines = source.split('\n')
    var index = Math.max(0, Math.min(yamlMarkerEdit.lineIndex, lines.length - 1))
    lines[index] = (yamlMarkerEdit.input.value || '').replace(/[\r\n]+/g, '')
    var next = lines.join('\n')
    yamlMarkerEdit.source = next
    // Do not call Vditor's input callback for every marker character. That
    // callback can re-render the source pane and steal focus from the input.
    setMarkdownBridgeSource(yamlMarkerEdit.editor, next)
    return true
  }

  function preserveFormerFrontMatterSeparator(edit, source) {
    var range = edit && edit.initialRange
    if (!range || edit.markerType !== 'yaml-front-matter-open-marker') return source
    var lines = source.split('\n')
    if (/^---[ \t]*$/.test(lines[range.open] || '')) return source
    if (!/^---[ \t]*$/.test(lines[range.close] || '')) return source
    // Removing the opening delimiter turns the old closing delimiter into
    // ordinary Markdown. Keep one blank line before it so CommonMark renders
    // an HR instead of reinterpreting the preceding YAML text as a Setext H2.
    if ((lines[range.close - 1] || '').trim()) lines.splice(range.close, 0, '')
    return lines.join('\n')
  }

  function commitYamlMarkerEdit() {
    if (!yamlMarkerEdit) return false
    var edit = yamlMarkerEdit
    yamlMarkerEdit = null
    if (edit.marker && edit.marker.isConnected) edit.marker.style.visibility = ''
    if (edit.input && edit.input.isConnected) edit.input.remove()
    if (edit.node && edit.node.isConnected) edit.node.classList.remove('eyan-yaml-editing')
    var editor = edit.editor || getEditor()
    var source = preserveFormerFrontMatterSeparator(edit, edit.source || (editor && normalizedMarkdownText(editor.getValue())))
    if (editor && typeof editor.setValue === 'function' && source != null) {
      editor.setValue(source, false)
      setMarkdownBridgeSource(editor, source)
      if (source !== edit.initialSource) notifyMarkdownEdit(editor, source)
    }
    positionYamlOverlays()
    schedulePreviewYamlSyntax()
    return true
  }

  function handleYamlMarkerInput(event) {
    if (!yamlMarkerOwnsEvent(event)) return false
    event.stopPropagation()
    updateYamlMarkerSource()
    return true
  }

  function schedulePreviewYamlSyntax() {
    if (previewYamlFrame) return
    previewYamlFrame = requestAnimationFrame(paintPreviewYamlSyntax)
  }

  function paintPreviewYamlSyntax() {
    previewYamlFrame = null
    if (!window.CSS || !CSS.highlights || typeof window.Highlight !== 'function') return
    if (previewYamlComposing) return // Keep native live Ranges through IME composition.
    paintPreviewMermaidSyntax()
    paintPreviewCodeSyntax()
    var names = ['key', 'code-blue', 'code-string', 'code-comment', 'code-keyword', 'bullet']
    var grouped = Object.create(null)
    names.forEach(function (name) { grouped[name] = [] })
    if (state.mode !== 'preview') {
      document.querySelectorAll('.vditor-ir div[data-type="yaml-front-matter"].eyan-yaml-editing').forEach(function (node) { node.classList.remove('eyan-yaml-editing') })
    }
    if (state.mode === 'preview') {
      document.querySelectorAll('.vditor-ir .vditor-ir__marker--pre code.language-yaml, .vditor-ir .vditor-ir__marker--pre code.language-yml').forEach(function (code) {
        var index = buildTextRangeIndex(code, false)
        var frontMatterNode = code.closest('div[data-type="yaml-front-matter"]')
        var frontMatter = !!frontMatterNode
        if (frontMatter) {
          // The delimiter editor is an overlay outside Vditor's contenteditable
          // root, so its selection is not contained by this node. Keep the card
          // expanded while that overlay owns either delimiter.
          var selection = window.getSelection()
          var editing = !!(yamlMarkerEdit && yamlMarkerEdit.node === frontMatterNode) || !!(selection && frontMatterNode.contains(selection.anchorNode))
          frontMatterNode.classList.toggle('eyan-yaml-editing', editing)
          if (!editing) return
        }
        var cached = previewYamlTokens.get(code)
        if (!cached || cached.text !== index.text || cached.frontMatter !== frontMatter) {
          var spans = []
          var ready = frontMatter
          if (frontMatter) {
            // Match the existing front-matter overlay, including the colon.
            var offset = 0
            index.text.split('\n').forEach(function (line) {
              var colon = line.indexOf(':')
              if (colon > 0) spans.push({ start: offset, end: offset + colon + 1, role: 'key' })
              offset += line.length + 1
            })
          } else if (window.hljs && typeof window.hljs.highlight === 'function') {
            // Parse off-DOM: never insert token spans into the editable source.
            // Use the same YAML grammar and palette as the rendered preview.
            try {
              var template = document.createElement('template')
              template.innerHTML = window.hljs.highlight(index.text, { language: 'yaml', ignoreIllegals: true }).value
              var walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
              var textNode, at = 0
              while ((textNode = walker.nextNode())) {
                var parent = textNode.parentElement
                var role = ''
                while (parent && !role) {
                  var classes = parent.className || ''
                  role = /\bhljs-number\b/.test(classes) ? 'code-blue' : /\bhljs-bullet\b/.test(classes) ? 'bullet' : semanticRoleForHljsClass(classes)
                  parent = parent.parentElement
                }
                if (grouped[role]) spans.push({ start: at, end: at + textNode.length, role: role })
                at += textNode.length
              }
              ready = at === index.text.length
            } catch (_) {}
          }
          cached = { text: index.text, frontMatter: frontMatter, spans: spans }
          if (ready) previewYamlTokens.set(code, cached)
        }
        cached.spans.forEach(function (span) {
          var range = index.range(span.start, span.end)
          if (range) grouped[span.role].push(range)
        })
      })
    }
    names.forEach(function (name) {
      var key = 'eyan-preview-yaml-' + name
      if (grouped[name].length) CSS.highlights.set(key, createCssHighlight(grouped[name]))
      else CSS.highlights.delete(key)
    })
    positionYamlOverlays()
  }

  // Roles a fenced code block can paint while being edited. These mirror the
  // rendered hljs palette so colors survive entering edit state.
  var PREVIEW_CODE_ROLES = ['base', 'code-keyword', 'code-title', 'code-blue', 'code-string', 'code-orange', 'code-comment', 'code-green', 'code-red']

  function paintPreviewCodeSyntax() {
    var grouped = Object.create(null)
    PREVIEW_CODE_ROLES.forEach(function (role) { grouped[role] = [] })
    if (state.mode === 'preview') {
      document.querySelectorAll('.vditor-ir .vditor-ir__marker--pre code[class*="language-"]').forEach(function (code) {
        var language = (/language-([\w+#-]+)/.exec(code.className || '') || [])[1] || ''
        // yaml and mermaid already have dedicated painters; diagrams have none.
        if (!language || /^(?:yaml|yml)$/.test(language) || DIAGRAM_FENCE_LANGUAGES.test(language)) return
        var index = buildTextRangeIndex(code, false)
        if (!index.text) return
        var cached = previewCodeTokens.get(code)
        if (!cached || cached.text !== index.text || cached.language !== language) {
          var spans = []
          // Parse off-DOM so no token spans are inserted into editable source.
          var ready = collectHljsSpans(index.text, language, 0, spans)
          cached = { text: index.text, language: language, spans: ready ? spans : [] }
          if (ready) previewCodeTokens.set(code, cached)
        }
        if (!cached.spans.length) return
        // Base keeps unparsed stretches at normal contrast instead of the
        // dimmed color the source surface applies to markers.
        var base = index.range(0, index.text.length)
        if (base) grouped.base.push(base)
        cached.spans.forEach(function (span) {
          var range = index.range(span.start, span.end)
          if (range && grouped[span.role]) grouped[span.role].push(range)
        })
      })
    }
    PREVIEW_CODE_ROLES.forEach(function (role) {
      var key = 'eyan-preview-code-' + role
      if (grouped[role].length) CSS.highlights.set(key, createCssHighlight(grouped[role]))
      else CSS.highlights.delete(key)
    })
  }

  function paintPreviewMermaidSyntax() {
    var grouped = { base: [], blue: [], red: [] }
    if (state.mode === 'preview') {
      var source = document.querySelector('.vditor-ir .vditor-reset')
      if (source) document.body.classList.toggle('eyan-source-dark', sourceSurfaceIsDark(source))
      document.querySelectorAll('.vditor-ir .vditor-ir__marker--pre code.language-mermaid').forEach(function (code) {
        var index = buildTextRangeIndex(code, false)
        var cached = previewMermaidTokens.get(code)
        if (!cached || cached.text !== index.text) {
          cached = { text: index.text, spans: [] }
          collectMermaidSpans(index.text, 0, cached.spans)
          previewMermaidTokens.set(code, cached)
        }
        var base = index.range(0, index.text.length)
        if (base) grouped.base.push(base)
        cached.spans.forEach(function (span) {
          var range = index.range(span.start, span.end)
          if (range && grouped[span.role]) grouped[span.role].push(range)
        })
      })
    }
    Object.keys(grouped).forEach(function (role) {
      var key = 'eyan-preview-mermaid-' + role
      if (grouped[role].length) CSS.highlights.set(key, createCssHighlight(grouped[role]))
      else CSS.highlights.delete(key)
    })
  }

  function resolveCustomColor(element, variable, fallback) {
    var probe = document.createElement('span')
    probe.style.position = 'fixed'
    probe.style.visibility = 'hidden'
    probe.style.pointerEvents = 'none'
    probe.style.color = 'var(' + variable + ')'
    document.body.appendChild(probe)
    var value = getComputedStyle(probe).color
    probe.remove()
    return value || fallback
  }

  function syncRenderedChartColors() {
    if (!window.echarts || typeof window.echarts.getInstanceByDom !== 'function') return
    var reset = getReset()
    if (!reset) return
    var styles = getComputedStyle(reset)
    var surface = styles.backgroundColor
    var text = styles.color
    var muted = resolveCustomColor(reset, '--eyan-muted', text)
    var border = resolveCustomColor(reset, '--eyan-border', muted)
    var signature = [surface, text, muted, border].join('|')

    document.querySelectorAll('.vditor-ir__preview .language-echarts, .vditor-wysiwyg__preview .language-echarts, .vditor-preview .language-echarts').forEach(function (element) {
      var chart = window.echarts.getInstanceByDom(element)
      if (!chart || element.dataset.eyanChartPalette === signature) return
      var option = chart.getOption()
      var patch = {
        backgroundColor: surface,
        textStyle: { color: text }
      }
      if (option.title && option.title.length) {
        patch.title = option.title.map(function () {
          return { textStyle: { color: text }, subtextStyle: { color: muted } }
        })
      }
      if (option.legend && option.legend.length) {
        patch.legend = option.legend.map(function () { return { textStyle: { color: text } } })
      }
      var axisNames = ['xAxis', 'yAxis', 'radiusAxis', 'angleAxis', 'singleAxis']
      axisNames.forEach(function (axisName) {
        if (!option[axisName] || !option[axisName].length) return
        patch[axisName] = option[axisName].map(function () {
          return {
            axisLabel: { color: muted },
            axisLine: { lineStyle: { color: border } },
            splitLine: { lineStyle: { color: border } },
            nameTextStyle: { color: text }
          }
        })
      })
      chart.setOption(patch, false, true)
      element.dataset.eyanChartPalette = signature
    })
  }

  function resizeRenderedCharts() {
    chartResizeFrame = null
    if (!window.echarts || typeof window.echarts.getInstanceByDom !== 'function') return
    document.querySelectorAll('.vditor-ir__preview .language-echarts, .vditor-wysiwyg__preview .language-echarts, .vditor-preview .language-echarts').forEach(function (element) {
      var chart = window.echarts.getInstanceByDom(element)
      if (chart && element.clientWidth > 0 && element.clientHeight > 0) chart.resize()
    })
  }

  function scheduleRenderedChartResize() {
    if (chartResizeFrame) cancelAnimationFrame(chartResizeFrame)
    chartResizeFrame = requestAnimationFrame(resizeRenderedCharts)
  }

  function observeRenderedChartSizes() {
    var elements = document.querySelectorAll('.vditor-ir__preview .language-echarts, .vditor-wysiwyg__preview .language-echarts, .vditor-preview .language-echarts')
    if (typeof ResizeObserver === 'function') {
      if (!chartResizeObserver) {
        chartResizeObserver = new ResizeObserver(function () {
          scheduleRenderedChartResize()
        })
      }
      chartResizeObserver.disconnect()
      elements.forEach(function (element) {
        chartResizeObserver.observe(element)
      })
    }
    scheduleRenderedChartResize()
  }

  function ensureOutline() {
    if (outline) return
    outline = document.createElement('aside')
    outline.id = 'eyan-outline'
    outline.innerHTML = '<div id="eyan-outline-rail"></div><div id="eyan-outline-panel"><div class="eyan-outline-header"><span>Outline</span><div class="eyan-outline-actions"><button id="eyan-outline-expand" type="button" title="Expand" aria-label="Expand" data-tooltip="Expand">' + outlineChevronSvg('down') + '</button><button id="eyan-outline-collapse" type="button" title="Collapse" aria-label="Collapse" data-tooltip="Collapse">' + outlineChevronSvg('up') + '</button><button id="eyan-outline-pin" type="button" title="Pin outline" aria-label="Pin outline" data-tooltip="Pin outline">' + outlinePinSvg(false) + '</button></div></div><div id="eyan-outline-list"></div></div><div id="eyan-outline-resize" role="separator" aria-orientation="vertical" aria-label="Resize outline"></div>'
    document.body.appendChild(outline)
    var rail = outline.querySelector('#eyan-outline-rail')
    if (typeof ResizeObserver === 'function') {
      outlineRailResizeObserver = new ResizeObserver(function () {
        if (outlineRailResizeFrame) cancelAnimationFrame(outlineRailResizeFrame)
        outlineRailResizeFrame = requestAnimationFrame(function () {
          outlineRailResizeFrame = null
          var reset = getReset()
          if (reset) renderOutlineRail(Array.from(reset.querySelectorAll('h1,h2,h3,h4,h5,h6')))
        })
      })
      outlineRailResizeObserver.observe(rail)
    }
    outline.addEventListener('mouseleave', function () {
      outline.classList.remove('eyan-just-unpinned')
    })
    outline.addEventListener('mouseenter', function () {
      outline.classList.remove('eyan-just-unpinned')
    })
    outline.querySelector('#eyan-outline-pin').addEventListener('click', function () {
      state.pinned = !state.pinned
      if (!state.pinned) {
        state.outlineWidth = DEFAULT_OUTLINE_WIDTH
        document.documentElement.style.setProperty('--eyan-outline-width', state.outlineWidth + 'px')
        document.body.style.setProperty('--eyan-outline-width', state.outlineWidth + 'px')
      }
      outline.classList.toggle('eyan-pinned', state.pinned)
      outline.classList.toggle('eyan-collapse-now', !state.pinned)
      outline.classList.toggle('eyan-just-unpinned', !state.pinned)
      document.body.classList.toggle('eyan-outline-pinned', state.pinned)
      this.innerHTML = outlinePinSvg(state.pinned)
      this.title = state.pinned ? 'Close pinned outline' : 'Pin outline'
      this.setAttribute('aria-label', this.title)
      this.dataset.tooltip = state.pinned ? 'Close outline' : 'Pin outline'
      if (window.vscode) window.vscode.postMessage({ command: 'outline-pinned', pinned: state.pinned })
      if (!state.pinned && window.vscode) window.vscode.postMessage({ command: 'outline-width', width: DEFAULT_OUTLINE_WIDTH })
    })
    outline.querySelector('#eyan-outline-expand').addEventListener('click', function () { setAllOutlineExpanded(true) })
    outline.querySelector('#eyan-outline-collapse').addEventListener('click', function () { collapseOutlineToDefault() })
    var resize = outline.querySelector('#eyan-outline-resize')
    resize.addEventListener('pointerdown', function (event) {
      if (!state.pinned) return
      event.preventDefault()
      event.stopPropagation()
      var startX = event.clientX
      var startWidth = state.outlineWidth
      var pointerId = event.pointerId
      var frame = null
      var pendingWidth = startWidth
      var maxWidth = Math.max(startWidth, Math.min(520, Math.max(MIN_OUTLINE_WIDTH, window.innerWidth - 280)))
      resize.classList.add('eyan-dragging')
      document.body.classList.add('eyan-outline-resizing')
      resize.setAttribute('aria-valuenow', String(Math.round(startWidth)))
      if (resize.setPointerCapture) resize.setPointerCapture(pointerId)
      var applyWidth = function () {
        frame = null
        state.outlineWidth = pendingWidth
        document.documentElement.style.setProperty('--eyan-outline-width', pendingWidth + 'px')
        document.body.style.setProperty('--eyan-outline-width', pendingWidth + 'px')
      }
      var move = function (moveEvent) {
        if (moveEvent.pointerId !== pointerId) return
        pendingWidth = Math.max(MIN_OUTLINE_WIDTH, Math.min(maxWidth, startWidth + startX - moveEvent.clientX))
        resize.setAttribute('aria-valuenow', String(Math.round(pendingWidth)))
        if (!frame) frame = requestAnimationFrame(applyWidth)
      }
      var stop = function (stopEvent) {
        if (stopEvent && stopEvent.pointerId !== pointerId) return
        if (frame) cancelAnimationFrame(frame)
        state.outlineWidth = pendingWidth
        document.documentElement.style.setProperty('--eyan-outline-width', pendingWidth + 'px')
        document.body.style.setProperty('--eyan-outline-width', pendingWidth + 'px')
        resize.classList.remove('eyan-dragging')
        document.body.classList.remove('eyan-outline-resizing')
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', stop)
        document.removeEventListener('pointercancel', stop)
        resize.removeEventListener('lostpointercapture', stop)
        if (resize.hasPointerCapture && resize.hasPointerCapture(pointerId)) resize.releasePointerCapture(pointerId)
        if (window.vscode) window.vscode.postMessage({ command: 'outline-width', width: state.outlineWidth })
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', stop)
      document.addEventListener('pointercancel', stop)
      resize.addEventListener('lostpointercapture', stop)
    })
    applyOutlinePreferences({})
  }

  function cleanHeading(text) { return (text || '').replace(/^#{1,6}\s*/, '').trim() }

  function getRenderedHeadings(reset) {
    return reset ? Array.from(reset.querySelectorAll('h1,h2,h3,h4,h5,h6')) : []
  }

  function topLevelRenderedBlock(reset, node) {
    var block = node
    while (block && block.parentElement && block.parentElement !== reset) block = block.parentElement
    return block && block.parentElement === reset ? block : null
  }

  function applyHeadingFolds(reset) {
    if (!reset) return
    var blocks = Array.from(reset.children)
    blocks.forEach(function (block) { block.classList.remove('eyan-heading-fold-hidden') })
    getRenderedHeadings(reset).forEach(function (heading, headingIndex) {
      if (!state.headingCollapsed[headingIndex]) return
      var block = topLevelRenderedBlock(reset, heading)
      if (!block) return
      var level = Number(heading.tagName.slice(1))
      var next = block.nextElementSibling
      while (next) {
        var boundary = /^H[1-6]$/.test(next.tagName) ? next : next.querySelector('h1,h2,h3,h4,h5,h6')
        if (boundary && Number(boundary.tagName.slice(1)) <= level) break
        next.classList.add('eyan-heading-fold-hidden')
        next = next.nextElementSibling
      }
    })
    if (activeLayoutTable && activeLayoutTable.closest('.eyan-heading-fold-hidden')) {
      tablePanelRequested = false
      deactivateTableLayoutEditor()
      refreshTablePanel()
    }
    if (activeGraphicBlock && activeGraphicBlock.target.closest('.eyan-heading-fold-hidden')) hideGraphicToolbar()
    hideContextMenus()
    scheduleStickyTableHeader()
  }

  function updateHeadingFoldButton(button, collapsed) {
    button.classList.toggle('eyan-collapsed', collapsed)
    button.setAttribute('aria-expanded', String(!collapsed))
    button.title = collapsed ? 'Expand section' : 'Collapse section'
    button.setAttribute('aria-label', button.title)
    button.innerHTML = outlineChevronSvg(collapsed ? 'right' : 'down')
  }

  function ensureHeadingFoldLayer() {
    if (headingFoldLayer) return headingFoldLayer
    headingFoldLayer = document.createElement('div')
    headingFoldLayer.id = 'eyan-heading-fold-layer'
    document.body.appendChild(headingFoldLayer)
    return headingFoldLayer
  }

  function positionHeadingFoldButtons() {
    headingFoldFrame = null
    var reset = getReset()
    if (!headingFoldLayer || !reset) return
    var headings = getRenderedHeadings(reset)
    Array.from(headingFoldLayer.children).forEach(function (button, index) {
      var heading = headings[index]
      if (!heading || heading.classList.contains('eyan-heading-fold-hidden')) {
        button.style.display = 'none'
        return
      }
      var rect = heading.getBoundingClientRect()
      button.style.display = 'inline-grid'
      button.style.left = (rect.left - 25) + 'px'
      button.style.top = (rect.top + 2) + 'px'
    })
  }

  function scheduleHeadingFoldPosition() {
    if (headingFoldFrame) return
    headingFoldFrame = requestAnimationFrame(positionHeadingFoldButtons)
  }

  function enhanceHeadingFolding() {
    var reset = getReset()
    if (!reset) return
    var layer = ensureHeadingFoldLayer()
    var headings = getRenderedHeadings(reset)
    while (layer.children.length > headings.length) layer.removeChild(layer.lastChild)
    headings.forEach(function (heading, index) {
      var button = layer.children[index]
      if (!button) {
        button = document.createElement('button')
        button.type = 'button'
        button.className = 'eyan-heading-fold-toggle'
        button.addEventListener('mousedown', function (event) {
          event.preventDefault()
          event.stopPropagation()
        })
        button.addEventListener('click', function (event) {
          event.preventDefault()
          event.stopPropagation()
          var headingIndex = Number(button.dataset.headingIndex)
          state.headingCollapsed[headingIndex] = !state.headingCollapsed[headingIndex]
          enhanceHeadingFolding()
          updateOutlineActive()
        })
        button.addEventListener('mouseenter', function () { button.classList.add('eyan-heading-hover') })
        button.addEventListener('mouseleave', function () { button.classList.remove('eyan-heading-hover') })
        layer.appendChild(button)
      }
      button.dataset.headingIndex = index
      updateHeadingFoldButton(button, !!state.headingCollapsed[index])
      if (!heading.dataset.eyanHeadingFoldHoverBound) {
        heading.dataset.eyanHeadingFoldHoverBound = '1'
        heading.addEventListener('mouseenter', function () {
          var target = layer.querySelector('[data-heading-index="' + index + '"]')
          if (target) target.classList.add('eyan-heading-hover')
        })
        heading.addEventListener('mouseleave', function (event) {
          var target = layer.querySelector('[data-heading-index="' + index + '"]')
          if (target && event.relatedTarget !== target) target.classList.remove('eyan-heading-hover')
        })
      }
    })
    applyHeadingFolds(reset)
    scheduleHeadingFoldPosition()
  }

  function expandHeadingAncestors(node) {
    var parent = node && node.parent
    var changed = false
    while (parent) {
      if (state.headingCollapsed[parent.index]) {
        state.headingCollapsed[parent.index] = false
        changed = true
      }
      parent = parent.parent
    }
    if (changed) enhanceHeadingFolding()
  }

  function getSplitHeadingAnchors(surface, source) {
    if (!surface) return []
    if (source) {
      return Array.from(surface.querySelectorAll('[data-type="heading-marker"]'))
    }
    return Array.from(surface.querySelectorAll('.vditor-reset h1, .vditor-reset h2, .vditor-reset h3, .vditor-reset h4, .vditor-reset h5, .vditor-reset h6'))
  }

  function getAnchorTop(surface, anchor) {
    return anchor.getBoundingClientRect().top - surface.getBoundingClientRect().top + surface.scrollTop
  }

  function ensureSplitDivider() {
    if (state.mode !== 'split') return
    var content = document.querySelector('.vditor-content')
    var source = document.querySelector('.vditor-sv')
    var preview = document.querySelector('.vditor-preview')
    if (!content || !source || !preview) return
    if (!splitDivider) {
      splitDivider = document.createElement('div')
      splitDivider.id = 'eyan-split-divider'
      splitDivider.setAttribute('role', 'separator')
      splitDivider.setAttribute('aria-orientation', 'vertical')
      splitDivider.setAttribute('aria-label', 'Resize split editor')
      splitDivider.addEventListener('pointerdown', function (event) {
        if (window.innerWidth <= 820) return
        var currentContent = document.querySelector('.vditor-content')
        var currentSource = document.querySelector('.vditor-sv')
        if (!currentContent || !currentSource || splitDivider.parentNode !== currentContent) return
        event.preventDefault()
        event.stopPropagation()
        splitDivider.classList.add('eyan-dragging')
        document.body.classList.add('eyan-split-resizing')
        var rect = currentContent.getBoundingClientRect()
        var start = event.clientX
        var initial = currentSource.getBoundingClientRect().width
        if (splitDivider.setPointerCapture) splitDivider.setPointerCapture(event.pointerId)
        var move = function (moveEvent) {
          if (moveEvent.pointerId !== event.pointerId) return
          var minSource = 260
          var minPreview = 280
          var maxSource = Math.max(minSource, rect.width - minPreview - splitDivider.offsetWidth)
          var width = Math.max(minSource, Math.min(maxSource, initial + (moveEvent.clientX - start)))
          var ratio = (width / rect.width) * 100
          currentContent.style.setProperty('--eyan-split-source-width', ratio + '%')
          splitDivider.setAttribute('aria-valuenow', String(Math.round(width)))
        }
        var up = function (upEvent) {
          if (upEvent && upEvent.pointerId !== event.pointerId) return
          splitDivider.classList.remove('eyan-dragging')
          document.body.classList.remove('eyan-split-resizing')
          splitDivider.removeEventListener('pointermove', move)
          splitDivider.removeEventListener('pointerup', up)
          splitDivider.removeEventListener('pointercancel', up)
          splitDivider.removeEventListener('lostpointercapture', up)
          if (splitDivider.hasPointerCapture && splitDivider.hasPointerCapture(event.pointerId)) {
            splitDivider.releasePointerCapture(event.pointerId)
          }
        }
        splitDivider.addEventListener('pointermove', move)
        splitDivider.addEventListener('pointerup', up)
        splitDivider.addEventListener('pointercancel', up)
        splitDivider.addEventListener('lostpointercapture', up)
      })
    }
    if (splitDivider.parentNode !== content) content.insertBefore(splitDivider, preview)
    if (!content.style.getPropertyValue('--eyan-split-source-width')) content.style.setProperty('--eyan-split-source-width', '50%')
  }

  function ensureSplitOverlays() {
    var gutter = document.getElementById('eyan-split-line-numbers')
    var indentGuides = document.getElementById('eyan-split-indent-guides')
    if (!gutter) {
      gutter = document.createElement('div')
      gutter.id = 'eyan-split-line-numbers'
      gutter.setAttribute('aria-hidden', 'true')
      document.body.appendChild(gutter)
    }
    if (!indentGuides) {
      indentGuides = document.createElement('div')
      indentGuides.id = 'eyan-split-indent-guides'
      indentGuides.setAttribute('aria-hidden', 'true')
      document.body.appendChild(indentGuides)
    }
    return { gutter: gutter, indentGuides: indentGuides }
  }

  function hideSplitOverlays() {
    var gutter = document.getElementById('eyan-split-line-numbers')
    var indentGuides = document.getElementById('eyan-split-indent-guides')
    if (gutter) gutter.style.display = 'none'
    if (indentGuides) indentGuides.style.display = 'none'
  }

  function paintSplitOverlays(cache) {
    if (!cache || state.mode !== 'split' || !cache.source.isConnected) {
      hideSplitOverlays()
      return
    }
    var overlays = ensureSplitOverlays()
    var source = cache.source
    var sourceRect = source.getBoundingClientRect()
    var scrollTop = source.scrollTop
    overlays.gutter.style.display = 'block'
    overlays.gutter.style.left = sourceRect.left + 'px'
    overlays.gutter.style.top = sourceRect.top + 'px'
    overlays.gutter.style.height = sourceRect.height + 'px'
    overlays.indentGuides.style.display = 'block'
    overlays.indentGuides.style.left = sourceRect.left + 'px'
    overlays.indentGuides.style.top = sourceRect.top + 'px'
    overlays.indentGuides.style.width = sourceRect.width + 'px'
    overlays.indentGuides.style.height = sourceRect.height + 'px'

    var activeLineIndex = getSplitActiveLineIndex(source, cache.text)
    var numberHtml = ''
    cache.metrics.forEach(function (metric, index) {
      var top = metric.documentTop - scrollTop
      if (top + cache.lineHeight < 0 || top > sourceRect.height) return
      var lineNumber = cache.lineNumberMap[index]
      var activeClass = index === activeLineIndex && lineNumber != null ? ' class="eyan-active"' : ''
      numberHtml += '<span' + activeClass + ' data-source-line-index="' + index + '" style="top:' + top + 'px">' + (lineNumber == null ? '' : lineNumber) + '</span>'
    })
    overlays.gutter.innerHTML = numberHtml

    var guideHtml = ''
    cache.guideSegments.forEach(function (guide) {
      var top = guide.documentTop - scrollTop
      if (top + guide.height < 0 || top > sourceRect.height) return
      guideHtml += '<span style="left:' + guide.left + 'px;top:' + top + 'px;height:' + guide.height + 'px"></span>'
    })
    overlays.indentGuides.innerHTML = guideHtml
  }

  function renderSplitLineNumbers() {
    splitLineNumberFrame = 0
    var source = document.querySelector('.vditor-sv')
    if (state.mode !== 'split' || !source || getComputedStyle(source).display === 'none') {
      splitLineLayoutCache = null
      hideSplitOverlays()
      return
    }
    enhanceSplitWrappedCodeLines(source)

    var sourceRect = source.getBoundingClientRect()
    var sourceStyle = getComputedStyle(source)
    var lineHeight = parseFloat(sourceStyle.lineHeight) || 22

    // Vditor's Split source textContent is the exact Markdown source. Mapping
    // its text offsets back to DOM ranges keeps logical line numbers aligned
    // while wrapped continuations correctly remain unnumbered.
    var text = source.textContent || ''
    var entries = []
    var offset = 0
    var walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) {
      entries.push({ node: node, start: offset, end: offset + node.data.length })
      offset += node.data.length
    }

    function rectAt(globalOffset) {
      var low = 0
      var high = entries.length - 1
      while (low <= high) {
        var mid = (low + high) >> 1
        var entry = entries[mid]
        if (globalOffset < entry.start) high = mid - 1
        else if (globalOffset >= entry.end) low = mid + 1
        else {
          var localOffset = globalOffset - entry.start
          var parent = entry.node.parentElement
          if (parent && getComputedStyle(parent).display === 'none') {
            var newline = parent.parentElement
            var br = newline && newline.querySelector('br')
            return br ? br.getBoundingClientRect() : null
          }
          var range = document.createRange()
          range.setStart(entry.node, localOffset)
          range.setEnd(entry.node, Math.min(localOffset + 1, entry.node.length))
          var rect = range.getBoundingClientRect()
          return rect.width || rect.height ? rect : null
        }
      }
      return null
    }

    var lines = text.split('\n')
    var documentLines = (typeof state.documentText === 'string' ? state.documentText : text).replace(/\r\n/g, '\n').split('\n')
    var lineNumberMap = mapSplitSourceLines(lines, documentLines)
    var lineStart = 0
    var previousDocumentTop = source.scrollTop + (parseFloat(sourceStyle.paddingTop) || 0)
    var metrics = []
    lines.forEach(function (line, index) {
      var lineEnd = lineStart + line.length
      var rect = null
      for (var position = lineStart; position < lineEnd && !rect; position++) rect = rectAt(position)
      if (!rect && lineEnd < text.length) rect = rectAt(lineEnd)
      var documentTop = rect ? rect.top - sourceRect.top + source.scrollTop : previousDocumentTop + (index ? lineHeight : 0)
      previousDocumentTop = documentTop
      metrics.push({ index: index, text: line, documentTop: documentTop })
      lineStart = lineEnd + 1
    })
    splitLineLayoutCache = {
      source: source,
      text: text,
      lineHeight: lineHeight,
      metrics: metrics,
      lineNumberMap: lineNumberMap,
      guideSegments: buildSplitIndentGuides(source, lines, metrics, sourceStyle, lineHeight),
    }
    paintSplitOverlays(splitLineLayoutCache)
  }

  function normalizeSplitLine(line) {
    return String(line || '').trim().replace(/\s+/g, ' ').replace(/\[X\]/g, '[x]').toLowerCase()
  }

  function splitLinesEquivalent(left, right) {
    return normalizeSplitLine(left) === normalizeSplitLine(right)
  }

  function mapSplitSourceLines(sourceLines, documentLines) {
    var mapped = new Array(sourceLines.length).fill(null)
    var sourceIndex = 0
    var documentIndex = 0
    var LOOKAHEAD = 24
    while (sourceIndex < sourceLines.length && documentIndex < documentLines.length) {
      if (splitLinesEquivalent(sourceLines[sourceIndex], documentLines[documentIndex])) {
        mapped[sourceIndex++] = ++documentIndex
        continue
      }
      var sourceAhead = 0
      var documentAhead = 0
      for (var sourceStep = 1; sourceStep <= LOOKAHEAD && sourceIndex + sourceStep < sourceLines.length; sourceStep++) {
        if (splitLinesEquivalent(sourceLines[sourceIndex + sourceStep], documentLines[documentIndex])) {
          sourceAhead = sourceStep
          break
        }
      }
      for (var documentStep = 1; documentStep <= LOOKAHEAD && documentIndex + documentStep < documentLines.length; documentStep++) {
        if (splitLinesEquivalent(sourceLines[sourceIndex], documentLines[documentIndex + documentStep])) {
          documentAhead = documentStep
          break
        }
      }
      if (sourceAhead && (!documentAhead || sourceAhead <= documentAhead)) {
        sourceIndex += sourceAhead
        continue
      }
      if (documentAhead) {
        documentIndex += documentAhead
        continue
      }
      mapped[sourceIndex++] = ++documentIndex
    }
    while (sourceIndex < sourceLines.length && documentIndex < documentLines.length) mapped[sourceIndex++] = ++documentIndex
    return mapped
  }

  function getSplitActiveLineIndex(source, text) {
    var selection = window.getSelection()
    if (!selection || !selection.focusNode || !source.contains(selection.focusNode)) return -1
    if (selection.focusNode.nodeType === Node.TEXT_NODE) {
      var offset = 0
      var walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
      var node
      while ((node = walker.nextNode())) {
        if (node === selection.focusNode) {
          offset += selection.focusOffset
          return text.slice(0, offset).split('\n').length - 1
        }
        offset += node.data.length
      }
    }
    try {
      var range = document.createRange()
      range.selectNodeContents(source)
      range.setEnd(selection.focusNode, selection.focusOffset)
      var rangeOffset = range.cloneContents().textContent.length
      return text.slice(0, rangeOffset).split('\n').length - 1
    } catch (_) {
      return -1
    }
  }

  function splitLeadingColumns(line) {
    var columns = 0
    for (var index = 0; index < line.length; index++) {
      if (line[index] === ' ') columns++
      else if (line[index] === '\t') columns += 4 - (columns % 4)
      else break
    }
    return columns
  }

  function splitCharacterWidth(sourceStyle) {
    var probe = document.createElement('span')
    probe.textContent = '0000000000'
    probe.style.cssText = 'position:fixed;visibility:hidden;white-space:pre;font-family:' + sourceStyle.fontFamily + ';font-size:' + sourceStyle.fontSize
    document.body.appendChild(probe)
    var width = probe.getBoundingClientRect().width / 10
    probe.remove()
    return width || 8
  }

  function splitElementTextOffset(root, element) {
    var offset = 0
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) {
      if (element.contains(node)) return offset
      offset += node.data.length
    }
    return -1
  }

  function getSplitCodeBlocks(source, text) {
    var blocks = []
    var openMarker = null
    source.querySelectorAll('[data-type="code-block-open-marker"], [data-type="code-block-close-marker"]').forEach(function (marker) {
      if (marker.getAttribute('data-type') === 'code-block-open-marker') { openMarker = marker; return }
      var closeMarker = marker
      if (!openMarker) return
      var openOffset = splitElementTextOffset(source, openMarker)
      var closeOffset = splitElementTextOffset(source, closeMarker)
      if (openOffset < 0 || closeOffset <= openOffset) return
      blocks.push({
        element: source,
        contentStart: text.indexOf('\n', openOffset) + 1,
        contentEnd: closeOffset,
        start: text.slice(0, openOffset).split('\n').length,
        end: text.slice(0, closeOffset).split('\n').length - 1,
      })
      openMarker = null
    })
    return blocks
  }

  // Reparenting a text node detaches it long enough for the browser to collapse
  // any selection inside it, which threw the caret to the start of the code
  // block on every keystroke. The text nodes survive the move, so remember the
  // caret by node identity and put it back once the wrappers are in place.
  function captureSplitCaret(source) {
    var selection = window.getSelection()
    if (!selection || !selection.rangeCount || !source) return null
    var range
    try { range = selection.getRangeAt(0) } catch (_) { return null }
    if (!source.contains(range.startContainer) || !source.contains(range.endContainer)) return null
    return {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset
    }
  }

  function restoreSplitCaret(caret) {
    if (!caret || !caret.startContainer.isConnected || !caret.endContainer.isConnected) return
    var selection = window.getSelection()
    if (!selection) return
    var clamp = function (node, offset) {
      var limit = node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length
      return Math.max(0, Math.min(limit, offset))
    }
    try {
      var range = document.createRange()
      range.setStart(caret.startContainer, clamp(caret.startContainer, caret.startOffset))
      range.setEnd(caret.endContainer, clamp(caret.endContainer, caret.endOffset))
      selection.removeAllRanges()
      selection.addRange(range)
    } catch (_) {}
  }

  function enhanceSplitWrappedCodeLines(source) {
    var caret = captureSplitCaret(source)
    var restructured = false
    var blocks = getSplitCodeBlocks(source, source.textContent || '')
    // One walk maps every text node to its source offset. Walking from the top
    // per container was O(n²) and froze large Split documents for ~700ms.
    // Wrapping below only reparents text nodes, so the offsets stay valid.
    var textOffsets = new Map()
    if (blocks.length) {
      var offset = 0
      var walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
      var textNode
      while ((textNode = walker.nextNode())) {
        textOffsets.set(textNode, offset)
        offset += textNode.data.length
      }
    }
    blocks.forEach(function (block) {
      block.element.querySelectorAll('[data-type="text"]').forEach(function (container) {
        var firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
        var containerOffset = firstText && textOffsets.has(firstText) ? textOffsets.get(firstText) : -1
        if (containerOffset < block.contentStart || containerOffset >= block.contentEnd) return
        var currentWrapper = null
        Array.from(container.childNodes).forEach(function (node) {
          if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-type') === 'newline') {
            if (currentWrapper) currentWrapper.style.setProperty('--eyan-split-code-indent', splitLeadingColumns(currentWrapper.textContent) + 'ch')
            currentWrapper = null
            return
          }
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('eyan-split-code-visual-line')) {
            if (!currentWrapper) currentWrapper = node
            else {
              while (node.firstChild) currentWrapper.appendChild(node.firstChild)
              node.remove()
              restructured = true
            }
            return
          }
          if (node.nodeType !== Node.TEXT_NODE || !node.data) return
          if (!currentWrapper) {
            currentWrapper = document.createElement('span')
            currentWrapper.className = 'eyan-split-code-visual-line'
            node.parentNode.replaceChild(currentWrapper, node)
          }
          currentWrapper.appendChild(node)
          restructured = true
        })
        if (currentWrapper) currentWrapper.style.setProperty('--eyan-split-code-indent', splitLeadingColumns(currentWrapper.textContent) + 'ch')
      })
    })
    if (restructured) restoreSplitCaret(caret)
  }

  function buildSplitIndentGuides(source, lines, metrics, sourceStyle, lineHeight) {
    var blocks = getSplitCodeBlocks(source, source.textContent || '')
    if (!blocks.length) return []

    var charWidth = splitCharacterWidth(sourceStyle)
    var paddingLeft = parseFloat(sourceStyle.paddingLeft) || 0
    var guides = []
    blocks.forEach(function (block) {
      var depths = []
      for (var lineIndex = block.start; lineIndex < block.end; lineIndex++) {
        depths.push(lines[lineIndex].trim() ? Math.floor(splitLeadingColumns(lines[lineIndex]) / 2) : null)
      }
      depths.forEach(function (depth, localIndex) {
        if (depth != null) return
        var previousDepth = 0
        var nextDepth = 0
        for (var previous = localIndex - 1; previous >= 0; previous--) {
          if (depths[previous] != null) {
            previousDepth = depths[previous]
            break
          }
        }
        for (var next = localIndex + 1; next < depths.length; next++) {
          if (depths[next] != null) {
            nextDepth = depths[next]
            break
          }
        }
        depths[localIndex] = Math.min(previousDepth, nextDepth)
      })
      var maxDepth = depths.length ? Math.max.apply(Math, depths) : 0
      for (var level = 1; level <= maxDepth; level++) {
        var segmentStart = -1
        for (var depthIndex = 0; depthIndex <= depths.length; depthIndex++) {
          var active = depthIndex < depths.length && depths[depthIndex] >= level
          if (active && segmentStart < 0) segmentStart = depthIndex
          if ((!active || depthIndex === depths.length) && segmentStart >= 0) {
            var firstLineIndex = block.start + segmentStart
            var afterLineIndex = block.start + depthIndex
            var firstMetric = metrics[firstLineIndex]
            var afterMetric = metrics[afterLineIndex]
            if (firstMetric) {
              var top = firstMetric.documentTop
              var bottom = afterMetric ? afterMetric.documentTop : metrics[block.end - 1].documentTop + lineHeight
              guides.push({
                left: paddingLeft + (level - 1) * 2 * charWidth,
                documentTop: top,
                height: Math.max(lineHeight, bottom - top),
              })
            }
            segmentStart = -1
          }
        }
      }
    })
    return guides
  }

  function scheduleSplitLineNumbers() {
    splitLineLayoutCache = null
    if (splitLineNumberFrame) return
    splitLineNumberFrame = requestAnimationFrame(renderSplitLineNumbers)
  }

  function scheduleSplitOverlayScroll() {
    if (splitLineNumberFrame) return
    splitLineNumberFrame = requestAnimationFrame(function () {
      splitLineNumberFrame = 0
      if (splitLineLayoutCache) paintSplitOverlays(splitLineLayoutCache)
      else renderSplitLineNumbers()
    })
  }

  function scheduleSplitActiveLineNumber() {
    if (splitActiveLineFrame) return
    splitActiveLineFrame = requestAnimationFrame(function () {
      splitActiveLineFrame = 0
      var source = document.querySelector('.vditor-sv')
      var gutter = document.getElementById('eyan-split-line-numbers')
      if (state.mode !== 'split' || !source || !gutter) return
      var activeIndex = getSplitActiveLineIndex(source, source.textContent || '')
      var current = gutter.querySelector('span.eyan-active')
      if (current && Number(current.dataset.sourceLineIndex) !== activeIndex) current.classList.remove('eyan-active')
      var next = gutter.querySelector('span[data-source-line-index="' + activeIndex + '"]')
      if (next && next.textContent) next.classList.add('eyan-active')
    })
  }

  function bindSplitLineNumbers() {
    if (state.mode !== 'split') {
      scheduleSplitLineNumbers()
      return
    }
    var source = document.querySelector('.vditor-sv')
    if (!source) return
    if (splitLineNumberSource !== source) {
      if (splitLineNumberObserver) splitLineNumberObserver.disconnect()
      if (splitLineNumberResizeObserver) splitLineNumberResizeObserver.disconnect()
      splitLineNumberSource = source
      splitLineNumberObserver = new MutationObserver(scheduleSplitLineNumbers)
      splitLineNumberObserver.observe(source, { childList: true, subtree: true, characterData: true })
      if (typeof ResizeObserver !== 'undefined') {
        splitLineNumberResizeObserver = new ResizeObserver(scheduleSplitLineNumbers)
        splitLineNumberResizeObserver.observe(source)
      }
      source.addEventListener('scroll', scheduleSplitOverlayScroll)
    }
    scheduleSplitLineNumbers()
  }

  function clampScroll(surface, value) {
    return Math.max(0, Math.min(value, Math.max(0, surface.scrollHeight - surface.clientHeight)))
  }

  function setProgrammaticScroll(surface, value) {
    var top = clampScroll(surface, value)
    splitExpectedScroll.set(surface, top)
    surface.scrollTop = top
  }

  // Vditor may emit source scroll events while it rebuilds Split preview after
  // an input. They are rendering side effects, not user navigation: keep the
  // preview at its current position until that update finishes.
  function lockSplitPreviewDuringInput(source) {
    var preview = document.querySelector('.vditor-preview')
    if (state.mode !== 'split' || !source || !preview) return
    var now = Date.now()
    if (splitInputScrollLock && now <= splitInputScrollLock.until && splitInputScrollLock.preview === preview) {
      splitInputScrollLock.until = now + splitPreviewLockDuration()
      return
    }
    splitInputScrollLock = {
      source: source,
      preview: preview,
      top: preview.scrollTop,
      anchor: getScrollAnchorState(preview, getSplitAnchorTops(preview, false)),
      until: now + splitPreviewLockDuration()
    }
  }

  // The preview re-render lands preview.delay after the last keystroke, and
  // charts/mermaid/images keep settling for another second or so. The lock must
  // span that whole window, otherwise the scroll clamp on the innerHTML
  // replacement leaks through as the visible jump-up-then-flash.
  function splitPreviewLockDuration() {
    var editor = getEditor()
    var options = editor && editor.vditor ? editor.vditor.options : null
    var delay = options && options.preview && typeof options.preview.delay === 'number' ? options.preview.delay : 1000
    return Math.max(700, delay + 1500)
  }

  function splitInputLockIsActive() {
    if (!splitInputScrollLock) return false
    if (Date.now() > splitInputScrollLock.until || !splitInputScrollLock.preview.isConnected) {
      splitInputScrollLock = null
      return false
    }
    return true
  }

  function restoreSplitPreviewAfterInput(records) {
    if (!splitInputLockIsActive()) return
    var lock = splitInputScrollLock
    var touchesPreview = (records || []).some(function (record) {
      return record.target === lock.preview || lock.preview.contains(record.target)
    })
    if (!touchesPreview) return
    // Re-assert the pre-edit anchor position against the re-rendered content.
    // An absolute scrollTop restore drifts whenever the edit changed content
    // above the viewport; the saved anchor+progress tracks it.
    var saved = lock.anchor
    var target = lock.top
    if (saved) {
      var tops = getSplitAnchorTops(lock.preview, false)
      if (tops.length) {
        var current = tops[Math.min(saved.index, tops.length - 1)]
        var next = saved.index + 1 < tops.length ? tops[saved.index + 1] : Math.max(current + 1, lock.preview.scrollHeight)
        target = current + saved.progress * Math.max(1, next - current) - 24
      }
    }
    setProgrammaticScroll(lock.preview, target)
  }

  function scrollToHeadingIndex(index) {
    if (state.mode !== 'split') return false
    var source = document.querySelector('.vditor-sv')
    var preview = document.querySelector('.vditor-preview')
    if (!source || !preview) return false
    var sourceHeadings = getSplitHeadingAnchors(source, true)
    var previewHeadings = getSplitHeadingAnchors(preview, false)
    var sourceHeading = sourceHeadings[index]
    var previewHeading = previewHeadings[index]
    if (!sourceHeading && !previewHeading) return false
    if (sourceHeading) setProgrammaticScroll(source, getAnchorTop(source, sourceHeading) - 24)
    if (previewHeading) setProgrammaticScroll(preview, getAnchorTop(preview, previewHeading) - 24)
    return true
  }

  function buildOutline() {
    ensureOutline()
    var reset = getReset()
    if (!reset) return
    var headings = Array.from(reset.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    var rail = outline.querySelector('#eyan-outline-rail')
    var list = outline.querySelector('#eyan-outline-list')
    renderOutlineRail(headings)
    list.innerHTML = ''
    var roots = []
    var stack = []
    headings.forEach(function (heading, index) {
      var node = { heading: heading, index: index, level: Number(heading.tagName.slice(1)), children: [], depth: 0 }
      while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop()
      if (stack.length) {
        node.parent = stack[stack.length - 1]
        node.depth = node.parent.depth + 1
        node.parent.children.push(node)
      } else roots.push(node)
      stack.push(node)
    })
    var renderNode = function (node) {
      var row = document.createElement('div')
      row.className = 'eyan-outline-row' + (node.index === state.activeOutlineIndex ? ' eyan-active' : '')
      row.dataset.index = node.index
      row.style.setProperty('--eyan-outline-depth', node.depth)
      var disclosure = document.createElement('button')
      disclosure.type = 'button'
      disclosure.className = 'eyan-outline-disclosure' + (node.children.length ? '' : ' eyan-outline-disclosure-empty')
      disclosure.setAttribute('aria-label', node.children.length ? (state.outlineExpanded[node.index] === false ? 'Expand' : 'Collapse') : '')
      if (node.children.length) disclosure.innerHTML = outlineChevronSvg(state.outlineExpanded[node.index] === false ? 'right' : 'down')
      disclosure.addEventListener('click', function (event) {
        event.stopPropagation()
        if (!node.children.length) return
        state.outlineExpanded[node.index] = state.outlineExpanded[node.index] === false
        buildOutline()
      })
      row.appendChild(disclosure)
      var item = document.createElement('button')
      item.type = 'button'
      item.className = 'eyan-outline-item' + (node.index === state.activeOutlineIndex ? ' eyan-active' : '')
      item.dataset.level = node.level
      item.dataset.index = node.index
      item.textContent = cleanHeading(node.heading.textContent)
      row.dataset.tooltip = item.textContent
      item.addEventListener('click', function () {
        expandHeadingAncestors(node)
        setOutlineActive(node.index)
        state.outlineNavigationPending = node.index
        setTimeout(function () {
          if (state.outlineNavigationPending === node.index) state.outlineNavigationPending = null
        }, 300)
        requestAnimationFrame(function () {
          if (!scrollToHeadingIndex(node.index)) node.heading.scrollIntoView({ behavior: 'auto', block: 'start' })
        })
      })
      row.appendChild(item)
      list.appendChild(row)
      row.addEventListener('mouseenter', function () { showOutlineTooltip(row) })
      row.addEventListener('mouseleave', hideOutlineTooltip)
      if (state.outlineExpanded[node.index] !== false) node.children.forEach(renderNode)
    }
    roots.forEach(renderNode)
  }

  function renderOutlineRail(headings) {
    if (!outline) return
    var rail = outline.querySelector('#eyan-outline-rail')
    if (!rail) return
    rail.innerHTML = ''
    if (!headings.length) return
    var topAndBottomPadding = 20
    var tickGap = 8
    var tickPitch = 3 + tickGap
    var capacity = Math.max(1, Math.floor((Math.max(0, rail.clientHeight - topAndBottomPadding) + tickGap) / tickPitch))
    var count = headings.length
    if (count <= capacity) {
      headings.forEach(function (heading, index) {
        appendOutlineTick(rail, index, index, Number(heading.tagName.slice(1)), '')
      })
      return
    }
    var bucketCount = Math.min(count, capacity)
    var minimumLevel = Math.min.apply(Math, headings.map(function (heading) { return Number(heading.tagName.slice(1)) }))
    for (var bucket = 0; bucket < bucketCount; bucket++) {
      var start = Math.floor(bucket * count / bucketCount)
      var end = Math.floor((bucket + 1) * count / bucketCount) - 1
      var major = false
      for (var index = start; index <= end; index++) {
        if (Number(headings[index].tagName.slice(1)) === minimumLevel) {
          major = true
          break
        }
      }
      appendOutlineTick(rail, start, end, 0, major ? 'eyan-outline-tick-major' : 'eyan-outline-tick-minor')
    }
  }

  function appendOutlineTick(rail, start, end, level, densityClass) {
    var tick = document.createElement('span')
    tick.className = 'eyan-outline-tick' + (densityClass ? ' ' + densityClass : '')
    tick.dataset.startIndex = start
    tick.dataset.endIndex = end
    if (level) tick.dataset.level = level
    tick.classList.toggle('eyan-active', state.activeOutlineIndex >= start && state.activeOutlineIndex <= end)
    rail.appendChild(tick)
  }

  function setAllOutlineExpanded(expanded) {
    var reset = getReset()
    if (!reset) return
    Array.from(reset.querySelectorAll('h1,h2,h3,h4,h5,h6')).forEach(function (_, index) { state.outlineExpanded[index] = expanded })
    buildOutline()
  }

  function collapseOutlineToDefault() {
    var reset = getReset()
    if (!reset) return
    var headings = Array.from(reset.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    if (!headings.length) return
    var levels = headings.map(function (heading) { return Number(heading.tagName.slice(1)) })
    var minimum = Math.min.apply(Math, levels)
    var minimumCount = levels.filter(function (level) { return level === minimum }).length
    var deeper = levels.filter(function (level) { return level > minimum }).sort(function (a, b) { return a - b })
    var target = minimumCount === 1 && deeper.length ? deeper[0] : minimum
    levels.forEach(function (level, index) { state.outlineExpanded[index] = level < target })
    buildOutline()
  }

  function setOutlineActive(index) {
    if (!outline) return
    state.activeOutlineIndex = index
    outline.querySelectorAll('.eyan-outline-row').forEach(function (row) { row.classList.toggle('eyan-active', Number(row.dataset.index) === index) })
    outline.querySelectorAll('.eyan-outline-item').forEach(function (item) { item.classList.toggle('eyan-active', Number(item.dataset.index) === index) })
    outline.querySelectorAll('.eyan-outline-tick').forEach(function (tick) {
      var start = Number(tick.dataset.startIndex)
      var end = Number(tick.dataset.endIndex)
      tick.classList.toggle('eyan-active', index >= start && index <= end)
    })
  }

  function updateOutlineActive() {
    if (!outline) return
    if (state.outlineNavigationPending !== null) {
      setOutlineActive(state.outlineNavigationPending)
      return
    }
    var reset = getReset()
    if (!reset) return
    var headings = Array.from(reset.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    var active = 0
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].classList.contains('eyan-heading-fold-hidden')) continue
      if (headings[i].getBoundingClientRect().top <= 120) active = i
    }
    setOutlineActive(active)
  }

  function ensureBlockMenu() {
    if (handle) return
    handle = document.createElement('button')
    handle.id = 'eyan-block-handle'
    handle.type = 'button'
    handle.textContent = '+'
    handle.title = 'Click to add'
    document.body.appendChild(handle)
    menu = document.createElement('div')
    menu.id = 'eyan-block-menu'
    menu.className = 'eyan-context-menu'
    var actions = [
      { id: 'heading', label: 'Heading', markdown: '\n## New heading\n' },
      { id: 'bulleted-list', label: 'Bulleted list', markdown: '\n- List item\n' },
      { id: 'numbered-list', label: 'Numbered list', markdown: '\n1. First step\n' },
      { id: 'todo-list', label: 'To-do list', markdown: '\n- [ ] Todo\n' },
      { id: 'quote', label: 'Quote', markdown: '\n> Write a quote here.\n' },
      { id: 'code-block', label: 'Code block', markdown: '\n```\n// code goes here\n```\n' },
      { separator: true },
      { id: 'image', label: 'Image' },
      { id: 'table', label: 'Table', markdown: '\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n' },
      { id: 'link', label: 'Link', markdown: '[Link text](https://example.com)' },
      { id: 'file-link', label: 'File Link' },
      { id: 'divider', label: 'Divider', markdown: '\n\n***\n\n' }
    ]
    actions.forEach(function (entry) {
      if (entry.separator) {
        var separator = document.createElement('div')
        separator.className = 'eyan-context-menu-separator'
        menu.appendChild(separator)
        return
      }
      var item = document.createElement('button')
      item.className = 'eyan-context-menu-item eyan-block-menu-item'
      item.type = 'button'
      item.dataset.menuAction = entry.id
      item.innerHTML = '<span class="eyan-context-menu-icon">' + contextMenuIconSvg(entry.id) + '</span><span>' + entry.label + '</span>'
      item.addEventListener('mousedown', function (event) {
        // Keep Vditor's current caret/range when the menu item is pressed.
        event.preventDefault()
      })
      item.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        if (entry.id === 'file-link') {
          if (window.vscode && typeof window.vscode.postMessage === 'function') {
            window.vscode.postMessage({ command: 'pick-document-link' })
          }
          hideContextMenus()
          return
        }
        if (entry.id === 'image') {
          openImagePicker()
          hideContextMenus()
          return
        }
        var editor = getEditor()
        if (editor) {
          editor.focus()
          restoreInsertRange()
          // execCommand can report success while leaving IR mode unchanged. Vditor's
          // Markdown insertion API performs the required parse and keeps the caret.
          if (typeof editor.insertMD === 'function') editor.insertMD(entry.markdown)
          else editor.insertValue(entry.markdown)
        }
        hideContextMenus()
      })
      menu.appendChild(item)
    })
    document.body.appendChild(menu)
    handle.addEventListener('mouseenter', function () {
      clearTimeout(hideHandleTimer)
    })
    handle.addEventListener('mouseleave', function () {
      clearTimeout(hideHandleTimer)
      hideHandleTimer = setTimeout(function () {
        if (menu.style.display !== 'block') {
          handle.style.display = 'none'
          hoverBlock = null
        }
      }, 180)
    })
    handle.addEventListener('click', function (event) {
      event.stopPropagation()
      clearTimeout(hideHandleTimer)
      var rect = handle.getBoundingClientRect()
      positionFloatingMenu(rect)
    })
    menu.addEventListener('mouseenter', function () {
      clearTimeout(hideHandleTimer)
    })
    handle.addEventListener('mousedown', function (event) {
      // Do not let the gutter control steal the editor selection.
      event.preventDefault()
      saveInsertRange()
      if (hoverBlock && (!savedInsertRange || !hoverBlock.contains(savedInsertRange.startContainer))) {
        var walker = document.createTreeWalker(hoverBlock, NodeFilter.SHOW_TEXT)
        var lastText = null
        while (walker.nextNode()) lastText = walker.currentNode
        if (lastText) {
          savedInsertRange = document.createRange()
          savedInsertRange.setStart(lastText, lastText.textContent.length)
          savedInsertRange.collapse(true)
        } else {
          var emptyRange = document.createRange()
          emptyRange.selectNodeContents(hoverBlock)
          emptyRange.collapse(true)
          savedInsertRange = emptyRange
        }
      }
    })
    document.addEventListener('click', function (event) {
      if (!menu.contains(event.target) && event.target !== handle && (!tableContextMenu || !tableContextMenu.contains(event.target))) hideContextMenus()
    })
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hideContextMenus()
    }, true)
    document.addEventListener('scroll', hideContextMenus, true)
    document.addEventListener('beforeinput', hideContextMenus, true)
  }

  function contextMenuIconSvg(action) {
    var paths = {
      heading: '<path d="M5 5v14M5 12h10M15 5v14"></path><path d="M19 8h2M19 12h2M19 16h2"></path>',
      'bulleted-list': '<path d="M9 6h11M9 12h11M9 18h11"></path><circle cx="4" cy="6" r="1" class="eyan-icon-fill"></circle><circle cx="4" cy="12" r="1" class="eyan-icon-fill"></circle><circle cx="4" cy="18" r="1" class="eyan-icon-fill"></circle>',
      'numbered-list': '<path d="M10 6h10M10 12h10M10 18h10"></path><path d="M3.5 4.5h1v3M3.5 10.5c.5-.6 2.5-.8 2.5.5 0 1-2.5 2-2.5 3h2.7M3.5 17c.5-.5 2.5-.5 2.5.6 0 .7-.6 1-1.3 1 .8 0 1.5.4 1.5 1.1 0 1.2-2.1 1.3-2.8.7"></path>',
      'todo-list': '<rect x="3" y="3" width="7" height="7" rx="1"></rect><path d="m5 6 1.5 1.5L9 5M14 6h7"></path><rect x="3" y="14" width="7" height="7" rx="1"></rect><path d="M14 17h7"></path>',
      quote: '<path d="M9.5 6.5C6.5 7.6 5 9.8 5 13h4v4H4.5v-4c0-3.8 1.6-6.5 5-8.2M19.5 6.5C16.5 7.6 15 9.8 15 13h4v4h-4.5v-4c0-3.8 1.6-6.5 5-8.2"></path>',
      'code-block': '<path d="M8 5 4 12l4 7M16 5l4 7-4 7M13 4l-2 16"></path>',
      image: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8" cy="9" r="1.5"></circle><path d="m4 17 5-5 4 4 2-2 5 5"></path>',
      table: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 9h18M9 4v16M15 4v16"></path>',
      link: '<path d="M10 14a4.5 4.5 0 0 0 6.4.1l2.7-2.7A4.5 4.5 0 0 0 12.7 5l-1.5 1.5M14 10a4.5 4.5 0 0 0-6.4-.1l-2.7 2.7A4.5 4.5 0 0 0 11.3 19l1.5-1.5"></path>',
      'file-link': '<path d="M5 3.5h8l4 4V12M13 3.5V8h4M11 20.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2"></path><path d="m13.5 16.5 2-2a3 3 0 0 1 4.2 4.2l-2 2a3 3 0 0 1-4.2 0m3-3-2 2a3 3 0 0 1-4.2-4.2l2-2a3 3 0 0 1 4.2 0"></path>',
      divider: '<path d="M4 12h16"></path><circle cx="4" cy="12" r=".8" class="eyan-icon-fill"></circle><circle cx="20" cy="12" r=".8" class="eyan-icon-fill"></circle>',
      'fit-page': '<path d="M4 5h16M4 19h16M5 12h14M5 12l3-2.5M5 12l3 2.5M19 12l-3-2.5M19 12l-3 2.5"></path>',
      'header-row': '<rect class="eyan-table-grid-frame" x="3" y="3" width="18" height="18" rx="1"></rect><rect class="eyan-table-grid-shade" x="4" y="4" width="16" height="5"></rect><path d="M9 3v18M15 3v18M3 9h18M3 15h18"></path>',
      'header-column': '<rect class="eyan-table-grid-frame" x="3" y="3" width="18" height="18" rx="1"></rect><rect class="eyan-table-grid-shade" x="4" y="4" width="5" height="16"></rect><path d="M9 3v18M15 3v18M3 9h18M3 15h18"></path>',
      'distribute-columns': '<rect class="eyan-table-anchor" x="4" y="14" width="16" height="4" rx=".55"></rect><path d="M5 8h14M5 8l3-2.5M5 8l3 2.5M19 8l-3-2.5M19 8l-3 2.5"></path>',
      'row-above': '<path class="eyan-table-add-symbol" d="M6.5 4.5v6M3.5 7.5h6"></path><rect class="eyan-table-add" x="12.5" y="5.5" width="7.5" height="4" rx=".55"></rect><rect class="eyan-table-anchor" x="4" y="14.5" width="16" height="4" rx=".55"></rect>',
      'row-below': '<rect class="eyan-table-anchor" x="4" y="5.5" width="16" height="4" rx=".55"></rect><path class="eyan-table-add-symbol" d="M6.5 13.5v6M3.5 16.5h6"></path><rect class="eyan-table-add" x="12.5" y="14.5" width="7.5" height="4" rx=".55"></rect>',
      'column-left': '<path class="eyan-table-add-symbol" d="M4.5 6.5h6M7.5 3.5v6"></path><rect class="eyan-table-add" x="5.5" y="12.5" width="4" height="7.5" rx=".55"></rect><rect class="eyan-table-anchor" x="14.5" y="4" width="4" height="16" rx=".55"></rect>',
      'column-right': '<rect class="eyan-table-anchor" x="5.5" y="4" width="4" height="16" rx=".55"></rect><path class="eyan-table-add-symbol" d="M13.5 6.5h6M16.5 3.5v6"></path><rect class="eyan-table-add" x="14.5" y="12.5" width="4" height="7.5" rx=".55"></rect>',
      'delete-row': '<rect class="eyan-table-anchor" x="4" y="5.5" width="16" height="4" rx=".55"></rect><path class="eyan-table-delete-symbol" d="M3.5 13.5l6 6M9.5 13.5l-6 6"></path><rect class="eyan-table-delete" x="12.5" y="14.5" width="7.5" height="4" rx=".55"></rect>',
      'delete-column': '<rect class="eyan-table-anchor" x="5.5" y="4" width="4" height="16" rx=".55"></rect><path class="eyan-table-delete-symbol" d="M13.5 3.5l6 6M19.5 3.5l-6 6"></path><rect class="eyan-table-delete" x="14.5" y="12.5" width="4" height="7.5" rx=".55"></rect>',
      'delete-table': '<path d="M4 4h16v16H4zM4 10h16M10 4v16"></path><path class="eyan-table-delete-symbol" d="m13.5 13.5 7 7m0-7-7 7"></path>'
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[action] || '') + '</svg>'
  }

  function openImagePicker() {
    var editor = getEditor()
    if (!editor) return
    editor.focus()
    restoreInsertRange()
    var upload = editor.vditor && editor.vditor.toolbar && editor.vditor.toolbar.elements && editor.vditor.toolbar.elements.upload
    var input = upload && upload.querySelector('input[type="file"]')
    if (input) {
      input.setAttribute('accept', 'image/*')
      input.click()
    }
  }

  function hideContextMenus() {
    if (menu) menu.style.display = 'none'
    if (tableContextMenu) tableContextMenu.style.display = 'none'
    tableContextCellPosition = null
    if (handle) handle.style.display = 'none'
  }

  function saveInsertRange() {
    var selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    try { savedInsertRange = selection.getRangeAt(0).cloneRange() } catch (_) {}
  }

  function restoreInsertRange() {
    if (!savedInsertRange) return
    var selection = window.getSelection()
    if (!selection) return
    try {
      selection.removeAllRanges()
      selection.addRange(savedInsertRange)
    } catch (_) {}
  }

  document.addEventListener('selectionchange', function () {
    if (state.mode === 'preview') schedulePreviewYamlSyntax()
    var reset = document.querySelector('.vditor-ir .vditor-reset')
    var selection = window.getSelection()
    if (!reset || !selection || selection.rangeCount === 0 || !selection.anchorNode) return
    if (reset.contains(selection.anchorNode)) saveInsertRange()
  })

  function getCaretRangeFromPoint(x, y) {
    var range = null
    try {
      if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y)
      else if (document.caretPositionFromPoint) {
        var position = document.caretPositionFromPoint(x, y)
        if (position) {
          range = document.createRange()
          range.setStart(position.offsetNode, position.offset)
          range.collapse(true)
        }
      }
    } catch (_) {}
    return range
  }

  function showBlockMenu(left, top) {
    positionFloatingMenu({ left: left, right: left, top: top, bottom: top })
  }

  function positionFloatingMenu(anchorRect) {
    positionContextMenu(menu, anchorRect)
  }

  function positionContextMenu(targetMenu, anchorRect) {
    if (!targetMenu) return
    var gap = 6
    var edge = 8
    targetMenu.style.visibility = 'hidden'
    targetMenu.style.display = 'block'
    var menuRect = targetMenu.getBoundingClientRect()
    var below = window.innerHeight - anchorRect.bottom - edge
    var above = anchorRect.top - edge
    var top = anchorRect.bottom + gap
    if (below < menuRect.height + gap && above > below) top = anchorRect.top - menuRect.height - gap
    top = Math.max(edge, Math.min(top, window.innerHeight - menuRect.height - edge))
    var left = Math.max(edge, Math.min(anchorRect.left, window.innerWidth - menuRect.width - edge))
    targetMenu.style.left = left + 'px'
    targetMenu.style.top = top + 'px'
    targetMenu.style.visibility = 'visible'
  }

  function rememberTableCell(cell, reset, range) {
    if (!cell || !reset) return
    lastTableCell = cell
    var table = cell.closest('table')
    lastTableCellPosition = {
      table: Array.from(reset.querySelectorAll('table')).indexOf(table),
      row: Array.from(table.querySelectorAll('tr')).indexOf(cell.parentElement),
      column: Array.from(cell.parentElement.children).indexOf(cell)
    }
    if (range) {
      savedTableRange = range.cloneRange()
      savedInsertRange = range.cloneRange()
    }
  }

  function restoreTableRange() {
    if (!savedTableRange) return
    var selection = window.getSelection()
    if (!selection) return
    try {
      selection.removeAllRanges()
      selection.addRange(savedTableRange)
    } catch (_) {}
  }

  function executeTableContextCommand(type) {
    executeMarkdownTableCommand(type)
  }

  function prepareTableStructureChange(type) {
    if (!lastTableCell || !lastTableCell.isConnected) return
    var table = lastTableCell.closest('table')
    if (!table || !table.__eyanTableLayout) return
    var column = Array.from(lastTableCell.parentElement.querySelectorAll(':scope > th, :scope > td')).indexOf(lastTableCell)
    var row = Array.from(table.querySelectorAll('tr')).indexOf(lastTableCell.parentElement)
    var previousCount = renderedTableColumnCount(table)
    var delta = type === 'insertColumnL' || type === 'insertColumnR' ? 1 : type === 'deleteColumn' ? -1 : 0
    pendingTableStructure = {
      type: type,
      tableIndex: Number(table.dataset.eyanTableIndex),
      row: Math.max(0, row),
      column: Math.max(0, column),
      previousCount: previousCount,
      expectedCount: previousCount + delta,
      widths: (table.__eyanPixelWidths || tablePixelWidths(table, table.__eyanTableLayout)).slice(),
      config: cloneTableLayout(table.__eyanTableLayout),
      expires: Date.now() + 2000
    }
  }

  function placeCaretAtTableCellStart(cell) {
    if (!cell) return false
    var selection = window.getSelection()
    if (!selection) return false
    try {
      var range = document.createRange()
      var text = Array.from(cell.childNodes).find(function (node) { return node.nodeType === Node.TEXT_NODE })
      if (text) range.setStart(text, 0)
      else range.setStart(cell, 0)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      if (typeof cell.focus === 'function') cell.focus({ preventScroll: true })
      savedTableRange = range.cloneRange()
      savedInsertRange = range.cloneRange()
      return true
    } catch (_) {
      return false
    }
  }

  function revealInsertedTableColumn(table, rowIndex, columnIndex) {
    if (!table || !table.isConnected) return
    var row = table.querySelectorAll('tr')[Math.max(0, Math.min(table.querySelectorAll('tr').length - 1, rowIndex))]
    var cell = row && row.querySelectorAll(':scope > th, :scope > td')[columnIndex]
    if (!cell) return
    var tableRect = table.getBoundingClientRect()
    var cellRect = cell.getBoundingClientRect()
    var nextScroll = table.scrollLeft
    if (cellRect.left < tableRect.left) nextScroll -= tableRect.left - cellRect.left
    else if (cellRect.right > tableRect.right) nextScroll += cellRect.right - tableRect.right
    table.scrollLeft = Math.max(0, Math.min(table.scrollWidth - table.clientWidth, nextScroll))
    rememberTableScroll(table)
    lastTableCell = cell
    lastTableCellPosition = { table: Number(table.dataset.eyanTableIndex), row: rowIndex, column: columnIndex }
    placeCaretAtTableCellStart(cell)
    normalizeEmptyTableCaret(cell)
    scheduleStickyTableHeader()
  }

  function reconcilePendingTableStructure() {
    var pending = pendingTableStructure
    if (!pending) return false
    if (Date.now() > pending.expires) {
      pendingTableStructure = null
      return false
    }
    var reset = document.querySelector('.vditor-ir .vditor-reset')
    var table = reset && reset.querySelectorAll('table')[pending.tableIndex]
    if (!table || renderedTableColumnCount(table) !== pending.expectedCount) return false
    var config = cloneTableLayout(pending.config)
    var widths = pending.widths.slice()
    if (pending.type === 'insertColumnL' || pending.type === 'insertColumnR') {
      var insertAt = pending.column + (pending.type === 'insertColumnR' ? 1 : 0)
      widths.splice(Math.max(0, Math.min(widths.length, insertAt)), 0, 64)
      config.layout = 'custom'
      config.widths = { unit: 'px', values: widths }
    } else if (pending.type === 'deleteColumn') {
      widths.splice(Math.max(0, Math.min(widths.length - 1, pending.column)), 1)
      config.layout = 'custom'
      config.widths = { unit: 'px', values: widths }
    } else config.widths = { unit: 'px', values: widths }
    config.columnCount = pending.expectedCount
    table.dataset.eyanTableIndex = String(pending.tableIndex)
    table.dataset.eyanTableEditable = '1'
    tableLayoutSessions[pending.tableIndex] = cloneTableLayout(config)
    applyTableLayout(table, config)
    activeLayoutTable = table
    pendingTableStructure = null
    if (pending.type === 'insertColumnL' || pending.type === 'insertColumnR') {
      requestAnimationFrame(function () {
        revealInsertedTableColumn(table, pending.row, insertAt)
      })
    }
    return true
  }

  function activeTableFromContext() {
    var table = lastTableCell && lastTableCell.isConnected ? lastTableCell.closest('table') : null
    if (!table && activeLayoutTable && activeLayoutTable.isConnected) table = activeLayoutTable
    return table
  }

  function deleteTableFromContext() {
    var table = activeTableFromContext()
    var editor = getEditor()
    if (!table || !editor || typeof editor.getValue !== 'function' || typeof editor.setValue !== 'function') return false
    var tableIndex = Number(table.dataset.eyanTableIndex)
    if (!isFinite(tableIndex)) {
      var reset = document.querySelector('.vditor-ir .vditor-reset')
      tableIndex = reset ? Array.from(reset.querySelectorAll('table')).indexOf(table) : -1
    }
    var markdown = editor.getValue()
    var parsed = parseMarkdownTableBlocks(markdown)
    var block = parsed.tables[tableIndex]
    if (!block) return false
    parsed.lines.splice(block.start, block.end - block.start + 1)
    var next = parsed.lines.join('\n').replace(/\n{3,}/g, '\n\n')
    try {
      if (editor.vditor && editor.vditor.undo && typeof editor.vditor.undo.addToUndoStack === 'function') editor.vditor.undo.addToUndoStack(editor.vditor)
    } catch (_) {}
    state.documentText = next
    ;[tableLayoutSessions, tableScrollSessions, tableViewportWidthSessions].forEach(function (sessions) {
      delete sessions[tableIndex]
      Object.keys(sessions).map(Number).filter(function (index) { return index > tableIndex }).sort(function (a, b) { return a - b }).forEach(function (index) {
        sessions[index - 1] = sessions[index]
        delete sessions[index]
      })
    })
    clearTableRangeSelection()
    lastTableCell = null
    lastTableCellPosition = null
    editor.setValue(next, false)
    if (window.vscode && typeof window.vscode.postMessage === 'function') window.vscode.postMessage({ command: 'edit', content: next })
    scheduleEnhance()
    return true
  }

  function applyTableContextLayout(action) {
    var table = activeTableFromContext()
    if (!table || !table.__eyanTableLayout) return
    activeLayoutTable = table
    endTableSelectionForLayoutChange()
    var config = cloneTableLayout(table.__eyanTableLayout)
    if (action === 'fit-page') {
      if (config.layout === 'fit') {
        config.layout = 'auto'
        config.widths = null
      } else {
        config.layout = 'fit'
        config.widths = { unit: 'px', values: (table.__eyanPixelWidths || tablePixelWidths(table, config)).slice() }
      }
    } else if (action === 'header-row') config.headerRow = !config.headerRow
    else if (action === 'header-column') config.titleColumn = !config.titleColumn
    else if (action === 'distribute-columns') {
      var current = (table.__eyanPixelWidths || tablePixelWidths(table, config)).slice()
      var total = current.reduce(function (sum, width) { return sum + width }, 0)
      config.layout = 'custom'
      config.widths = { unit: 'px', values: Array(config.columnCount).fill(total / Math.max(1, config.columnCount)) }
    }
    persistActiveTableLayout(config)
  }

  function updateTableContextMenuState(cell, range) {
    if (!tableContextMenu) return
    var table = activeTableFromContext()
    var config = table && table.__eyanTableLayout
    ;[
      ['fit-page', !!config && config.layout === 'fit'],
      ['header-row', !!config && config.headerRow],
      ['header-column', !!config && config.titleColumn]
    ].forEach(function (entry) {
      var button = tableContextMenu.querySelector('[data-menu-action="' + entry[0] + '"]')
      if (!button) return
      button.classList.toggle('eyan-context-menu-toggle-on', entry[1])
      button.setAttribute('aria-checked', entry[1] ? 'true' : 'false')
      var toggle = button.querySelector('.eyan-context-menu-toggle')
      if (toggle) toggle.classList.toggle('eyan-on', entry[1])
    })
    var selectedArea = tableRangeSelection && tableRangeSelection.table === table
      ? (tableRangeSelection.endRow - tableRangeSelection.startRow + 1) * (tableRangeSelection.endColumn - tableRangeSelection.startColumn + 1)
      : 0
    var hasPreciseCaret = !!(cell && range && cell.contains(range.startContainer) && cell.contains(range.endContainer))
    var showLinkActions = selectedArea <= 1 && hasPreciseCaret
    ;['link', 'file-link'].forEach(function (action) {
      var item = tableContextMenu.querySelector('[data-menu-action="' + action + '"]')
      if (item) item.style.display = showLinkActions ? '' : 'none'
    })
    var linkSeparator = tableContextMenu.querySelector('[data-menu-separator="links"]')
    if (linkSeparator) linkSeparator.style.display = showLinkActions ? '' : 'none'
  }

  function ensureTableContextMenu() {
    if (tableContextMenu) return tableContextMenu
    tableContextMenu = document.createElement('div')
    tableContextMenu.id = 'eyan-table-context-menu'
    tableContextMenu.className = 'eyan-context-menu'
    var actions = [
      { id: 'fit-page', label: 'Fit page width', layout: true, toggle: true },
      { id: 'header-row', label: 'Header Row', layout: true, toggle: true },
      { id: 'header-column', label: 'Header Column', layout: true, toggle: true },
      { id: 'distribute-columns', label: 'Distribute Columns', layout: true },
      { separator: 'structure' },
      { id: 'row-below', label: 'Add Row', command: 'insertRowB' },
      { id: 'column-right', label: 'Add Column', command: 'insertColumnR' },
      { separator: 'delete' },
      { id: 'delete-row', label: 'Delete Row', command: 'deleteRow', danger: true },
      { id: 'delete-column', label: 'Delete Column', command: 'deleteColumn', danger: true },
      { id: 'delete-table', label: 'Delete Table', deleteTable: true, danger: true },
      { separator: 'links' },
      { id: 'link', label: 'Link', markdown: '[Link text](https://example.com)' },
      { id: 'file-link', label: 'File Link' }
    ]
    actions.forEach(function (entry) {
      if (entry.separator) {
        var separator = document.createElement('div')
        separator.className = 'eyan-context-menu-separator'
        separator.dataset.menuSeparator = entry.separator
        tableContextMenu.appendChild(separator)
        return
      }
      var item = document.createElement('button')
      item.type = 'button'
      item.className = 'eyan-context-menu-item'
      if (entry.danger) item.classList.add('eyan-context-menu-danger')
      if (entry.toggle) {
        item.setAttribute('role', 'menuitemcheckbox')
        item.setAttribute('aria-checked', 'false')
      }
      item.dataset.menuAction = entry.id
      item.innerHTML = '<span class="eyan-context-menu-icon">' + contextMenuIconSvg(entry.id) + '</span><span>' + entry.label + '</span>' + (entry.toggle ? '<span class="eyan-context-menu-toggle" aria-hidden="true"></span>' : '')
      item.addEventListener('mousedown', function (event) { event.preventDefault() })
      item.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        if (entry.layout) applyTableContextLayout(entry.id)
        else if (entry.command) executeTableContextCommand(entry.command)
        else if (entry.deleteTable) deleteTableFromContext()
        else if (entry.id === 'file-link') {
          restoreTableRange()
          if (savedTableRange) savedInsertRange = savedTableRange.cloneRange()
          if (window.vscode && typeof window.vscode.postMessage === 'function') window.vscode.postMessage({ command: 'pick-document-link' })
        } else {
          var editor = getEditor()
          if (editor) {
            editor.focus()
            restoreTableRange()
            if (typeof editor.insertMD === 'function') editor.insertMD(entry.markdown)
            else editor.insertValue(entry.markdown)
          }
        }
        hideContextMenus()
      })
      tableContextMenu.appendChild(item)
    })
    document.body.appendChild(tableContextMenu)
    return tableContextMenu
  }

  function showTableContextMenu(left, top, cell, range) {
    hideContextMenus()
    tableContextCellPosition = tableCellPosition(cell)
    activeLayoutTable = activeTableFromContext()
    var contextMenu = ensureTableContextMenu()
    updateTableContextMenuState(cell, range)
    positionContextMenu(contextMenu, { left: left, right: left, top: top, bottom: top })
  }

  function isBlockEmpty(block) {
    if (!block) return false
    return (block.textContent || '').replace(/[​ ﻿\s]/g, '') === ''
  }

  function positionHandle(left, top, height) {
    var size = 28
    handle.style.left = Math.max(4, left - size - 8) + 'px'
    handle.style.top = Math.max(4, top + height / 2 - size / 2) + 'px'
    handle.style.display = 'grid'
  }

  function showBlockHandle(block) {
    hoverBlock = block
    var rect = block.getBoundingClientRect()
    positionHandle(rect.left, rect.top, rect.height)
  }

  function showAnchorHandle(anchor) {
    hoverBlock = anchor.block
    positionHandle(anchor.left, anchor.top, anchor.height)
  }

  // 找到鼠标下方的「空行」锚点：真正的空块，或两个块之间的空白间隙（IR 折叠掉的空行）。
  function findEmptyAnchor(reset, y) {
    var blocks = Array.from(reset.children)
    for (var i = 0; i < blocks.length; i++) {
      var rect = blocks[i].getBoundingClientRect()
      if (y >= rect.top && y <= rect.bottom) {
        if (isBlockEmpty(blocks[i])) return { left: rect.left, top: rect.top, height: rect.height, block: blocks[i] }
        return null
      }
      if (y < rect.top && i > 0) {
        var prevRect = blocks[i - 1].getBoundingClientRect()
        if (rect.top - prevRect.bottom >= 8) return { left: rect.left, top: prevRect.bottom, height: rect.top - prevRect.bottom, block: blocks[i - 1] }
        return null
      }
    }
    return null
  }

  function bindBlockHover() {
    ensureBlockMenu()
    var reset = getReset()
    if (!reset || reset.dataset.eyanHoverBound) return
    reset.dataset.eyanHoverBound = '1'
    reset.addEventListener('mouseup', function (event) {
      var range = getCaretRangeFromPoint(event.clientX, event.clientY)
      if (range && reset.contains(range.startContainer)) savedInsertRange = range.cloneRange()
    })
    reset.addEventListener('mousemove', function (event) {
      if (state.mode !== 'preview') return
      clearTimeout(hideHandleTimer)
      var anchor = findEmptyAnchor(reset, event.clientY)
      if (!anchor) {
        hoverBlock = null
        if (handle.style.display !== 'none') handle.style.display = 'none'
        return
      }
      if (anchor.block === hoverBlock && handle.style.display !== 'none') return
      showAnchorHandle(anchor)
    })
    reset.addEventListener('mouseleave', function () {
      clearTimeout(hideHandleTimer)
      hideHandleTimer = setTimeout(function () {
        if (menu.style.display !== 'block') {
          handle.style.display = 'none'
          hoverBlock = null
        }
      }, 180)
    })
    reset.addEventListener('contextmenu', function (event) {
      if (state.mode !== 'preview') return
      var range = getCaretRangeFromPoint(event.clientX, event.clientY)
      var cell = event.target.closest('th, td')
      if (cell && reset.contains(cell)) {
        event.preventDefault()
        event.stopPropagation()
        rememberTableCell(cell, reset, range)
        showTableContextMenu(event.clientX, event.clientY, cell, range)
        return
      }
      var anchor = findEmptyAnchor(reset, event.clientY)
      if (!anchor) return
      event.preventDefault()
      event.stopPropagation()
      if (range && reset.contains(range.startContainer)) savedInsertRange = range.cloneRange()
      showAnchorHandle(anchor)
      handle.style.display = 'none'
      showBlockMenu(event.clientX, event.clientY)
    })
  }

  function enhanceInlineTableBreaks() {
    document.querySelectorAll('.vditor-ir td span[data-type="html-inline"], .vditor-ir th span[data-type="html-inline"]').forEach(function (node) {
      node.classList.toggle('eyan-table-line-break', /^<br\s*\/?>$/i.test((node.textContent || '').trim()))
    })
  }

  function splitMarkdownTableRow(line) {
    var text = String(line || '').trim()
    var cells = []
    var current = ''
    var codeFence = 0
    var separators = 0
    for (var i = 0; i < text.length; i++) {
      var char = text[i]
      if (char === '\\') {
        current += char
        if (i + 1 < text.length) current += text[++i]
        continue
      }
      if (char === '`') {
        var run = 1
        while (i + run < text.length && text[i + run] === '`') run += 1
        current += text.slice(i, i + run)
        if (!codeFence) codeFence = run
        else if (codeFence === run) codeFence = 0
        i += run - 1
        continue
      }
      if (char === '|' && !codeFence) {
        cells.push(current.trim())
        current = ''
        separators += 1
      } else current += char
    }
    cells.push(current.trim())
    if (!separators) return null
    if (text[0] === '|') cells.shift()
    if (text[text.length - 1] === '|') cells.pop()
    return cells
  }

  function parseMarkdownTableBlocks(markdown) {
    var lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
    var tables = []
    var fence = ''
    for (var i = 0; i < lines.length - 1; i++) {
      var fenceMatch = lines[i].match(/^\s*(`{3,}|~{3,})/)
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[1][0]
        else if (fence === fenceMatch[1][0]) fence = ''
        continue
      }
      if (fence) continue
      var header = splitMarkdownTableRow(lines[i])
      var delimiter = splitMarkdownTableRow(lines[i + 1])
      // Vditor may serialize a valid separator as a single dash for narrow
      // columns, so accept its canonical output as well as conventional ---.
      if (!header || !delimiter || !delimiter.length || !delimiter.every(function (cell) { return /^:?-+:?$/.test(cell) })) continue
      var start = i
      var rows = [header]
      i += 2
      while (i < lines.length) {
        var row = splitMarkdownTableRow(lines[i])
        if (!row) break
        rows.push(row)
        i += 1
      }
      tables.push({
        start: start,
        end: i - 1,
        rows: rows,
        columnCount: header.length,
        layout: defaultTableLayout(header.length)
      })
      i -= 1
    }
    return { lines: lines, tables: tables }
  }

  function serializeMarkdownTableRows(rows) {
    if (!rows || !rows.length) return []
    var columnCount = Math.max(1, rows.reduce(function (maximum, row) { return Math.max(maximum, row.length) }, 0))
    var normalized = rows.map(function (row) {
      var copy = row.slice(0, columnCount)
      while (copy.length < columnCount) copy.push('')
      return copy
    })
    var lines = ['| ' + normalized[0].join(' | ') + ' |']
    lines.push('| ' + Array(columnCount).fill('---').join(' | ') + ' |')
    normalized.slice(1).forEach(function (row) { lines.push('| ' + row.join(' | ') + ' |') })
    return lines
  }

  function renderedTableIndex(table) {
    var index = tableSessionIndex(table)
    if (index >= 0) return index
    var reset = document.querySelector('.vditor-ir .vditor-reset')
    return reset ? Array.from(reset.querySelectorAll('table.eyan-layout-table')).indexOf(table) : -1
  }

  function tableScrollContainer(table) {
    var node = table && table.parentElement
    while (node && node !== document.body) {
      var style = getComputedStyle(node)
      if (/(?:auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node
      node = node.parentElement
    }
    return document.querySelector('.vditor-ir') || document.scrollingElement || document.documentElement
  }

  function captureTableTransaction(table, options) {
    options = options || {}
    var tableIndex = renderedTableIndex(table)
    if (tableIndex < 0) return null
    var range = options.range || (tableRangeSelection && tableRangeSelection.table === table ? tableRangeSelection : null)
    var row = options.row != null ? options.row : range ? range.startRow : lastTableCellPosition && lastTableCellPosition.table === tableIndex ? lastTableCellPosition.row : 0
    var column = options.column != null ? options.column : range ? range.startColumn : lastTableCellPosition && lastTableCellPosition.table === tableIndex ? lastTableCellPosition.column : 0
    var anchorCell = tableCellAt(table, row, column) || table.querySelector('th, td')
    var scroller = tableScrollContainer(table)
    return {
      id: Date.now() + ':' + Math.random().toString(36).slice(2),
      tableIndex: tableIndex,
      row: Math.max(0, row),
      column: Math.max(0, column),
      range: range ? {
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startColumn,
        endColumn: range.endColumn
      } : null,
      restoreRange: options.restoreRange !== false,
      restoreCaret: !!options.restoreCaret,
      revealColumn: !!options.revealColumn,
      preserveVisualAnchor: options.preserveVisualAnchor !== false,
      anchorTop: anchorCell ? anchorCell.getBoundingClientRect().top : table.getBoundingClientRect().top,
      scrollLeft: Math.max(0, Number(table.scrollLeft) || 0),
      scroller: scroller,
      scrollerScrollTop: scroller ? Number(scroller.scrollTop) || 0 : 0,
      config: table.__eyanTableLayout ? cloneTableLayout(table.__eyanTableLayout) : defaultTableLayout(renderedTableColumnCount(table)),
      widths: (table.__eyanPixelWidths || []).slice(),
      expires: Date.now() + 1600
    }
  }

  function clearPendingTableTransaction(transaction) {
    if (transaction && pendingTableTransaction !== transaction) return
    pendingTableTransaction = null
    clearTimeout(pendingTableTransactionTimer)
    pendingTableTransactionTimer = null
  }

  function schedulePendingTableTransactionClear(transaction) {
    clearTimeout(pendingTableTransactionTimer)
    // Vditor can normalize IR table DOM again after its first rendered frame.
    // Keep the transaction alive long enough to project the caret/viewport onto
    // that final live DOM instead of leaving Selection on a detached cell.
    pendingTableTransactionTimer = setTimeout(function () { clearPendingTableTransaction(transaction) }, 900)
  }

  function restorePendingTableTransaction() {
    var transaction = pendingTableTransaction
    if (!transaction || Date.now() > transaction.expires) {
      if (transaction) clearPendingTableTransaction(transaction)
      return false
    }
    var reset = document.querySelector('.vditor-ir .vditor-reset')
    var table = reset && reset.querySelectorAll('table.eyan-layout-table')[transaction.tableIndex]
    if (!table) return false
    var rows = table.querySelectorAll('tr')
    if (!rows.length) return false
    var row = Math.max(0, Math.min(rows.length - 1, transaction.row))
    var columnCount = renderedTableColumnCount(table)
    var column = Math.max(0, Math.min(Math.max(0, columnCount - 1), transaction.column))
    table.scrollLeft = Math.max(0, Math.min(table.scrollWidth - table.clientWidth, transaction.scrollLeft))
    if (transaction.scroller && transaction.scroller.isConnected !== false) transaction.scroller.scrollTop = transaction.scrollerScrollTop
    var anchorCell = tableCellAt(table, row, column) || table.querySelector('th, td')
    if (transaction.preserveVisualAnchor && anchorCell && transaction.scroller && transaction.scroller.isConnected !== false) {
      var delta = anchorCell.getBoundingClientRect().top - transaction.anchorTop
      if (Math.abs(delta) > 0.5) transaction.scroller.scrollTop += delta
    }
    if (transaction.range && transaction.restoreRange) {
      tableRangeSelection = {
        table: table,
        startRow: Math.max(0, Math.min(rows.length - 1, transaction.range.startRow)),
        endRow: Math.max(0, Math.min(rows.length - 1, transaction.range.endRow)),
        startColumn: Math.max(0, Math.min(columnCount - 1, transaction.range.startColumn)),
        endColumn: Math.max(0, Math.min(columnCount - 1, transaction.range.endColumn))
      }
      paintTableRangeSelection()
    }
    lastTableCell = anchorCell
    lastTableCellPosition = { table: transaction.tableIndex, row: row, column: column }
    if (transaction.restoreCaret && anchorCell && transaction.restoredCell !== anchorCell) {
      placeCaretAtTableCellStart(anchorCell)
      transaction.restoredCell = anchorCell
    }
    if (transaction.revealColumn && anchorCell) revealInsertedTableColumn(table, row, column)
    schedulePendingTableTransactionClear(transaction)
    return true
  }

  function commitMarkdownTableTransaction(table, nextMarkdown, options) {
    var editor = getEditor()
    if (!table || !editor || typeof editor.setValue !== 'function') return false
    var transaction = captureTableTransaction(table, options)
    if (!transaction) return false
    if (options && options.config) {
      transaction.config = cloneTableLayout(options.config)
      transaction.widths = options.config.widths && options.config.widths.values ? options.config.widths.values.slice() : transaction.widths
      tableLayoutSessions[transaction.tableIndex] = cloneTableLayout(options.config)
    }
    pendingTableTransaction = transaction
    try {
      if (editor.vditor && editor.vditor.undo && typeof editor.vditor.undo.addToUndoStack === 'function') editor.vditor.undo.addToUndoStack(editor.vditor)
    } catch (_) {}
    state.documentText = nextMarkdown
    editor.setValue(nextMarkdown, false)
    if (window.vscode && typeof window.vscode.postMessage === 'function') window.vscode.postMessage({ command: 'edit', content: nextMarkdown })
    scheduleEnhance()
    return true
  }

  function activeTableCommandRange(table, row, column) {
    if (tableRangeSelection && tableRangeSelection.table === table) return {
      startRow: tableRangeSelection.startRow,
      endRow: tableRangeSelection.endRow,
      startColumn: tableRangeSelection.startColumn,
      endColumn: tableRangeSelection.endColumn
    }
    return { startRow: row, endRow: row, startColumn: column, endColumn: column }
  }

  function executeMarkdownTableCommand(type) {
    var table = activeTableFromContext()
    var editor = getEditor()
    if (!table || !editor || typeof editor.getValue !== 'function') return false
    var tableIndex = renderedTableIndex(table)
    var parsed = parseMarkdownTableBlocks(editor.getValue())
    var block = parsed.tables[tableIndex]
    if (!block || !block.rows.length) return false
    var contextPosition = tableContextCellPosition && tableContextCellPosition.table === table ? tableContextCellPosition : null
    var fallbackRow = contextPosition ? contextPosition.row : lastTableCellPosition && lastTableCellPosition.table === tableIndex ? lastTableCellPosition.row : 0
    var fallbackColumn = contextPosition ? contextPosition.column : lastTableCellPosition && lastTableCellPosition.table === tableIndex ? lastTableCellPosition.column : 0
    var range = activeTableCommandRange(table, fallbackRow, fallbackColumn)
    var rows = block.rows.map(function (row) { return row.slice() })
    var config = cloneTableLayout(table.__eyanTableLayout || defaultTableLayout(block.columnCount))
    var widths = (table.__eyanPixelWidths || tablePixelWidths(table, config)).slice()
    var targetRow = Math.max(0, Math.min(rows.length - 1, range.startRow))
    var targetColumn = Math.max(0, Math.min(block.columnCount - 1, range.startColumn))
    var revealColumn = false
    if (type === 'insertRowB') {
      targetRow = Math.min(rows.length, range.endRow + 1)
      rows.splice(targetRow, 0, Array(block.columnCount).fill(''))
    } else if (type === 'insertColumnR') {
      targetColumn = Math.min(block.columnCount, range.endColumn + 1)
      rows.forEach(function (row) { row.splice(targetColumn, 0, '') })
      widths.splice(targetColumn, 0, 64)
      config.layout = 'custom'
      config.widths = { unit: 'px', values: widths }
      config.columnCount = block.columnCount + 1
      revealColumn = true
    } else if (type === 'deleteRow') {
      var rowCount = range.endRow - range.startRow + 1
      rows.splice(range.startRow, rowCount)
      if (!rows.length) return deleteTableFromContext()
      targetRow = Math.min(range.startRow, rows.length - 1)
    } else if (type === 'deleteColumn') {
      var columnCount = range.endColumn - range.startColumn + 1
      if (columnCount >= block.columnCount) return deleteTableFromContext()
      rows.forEach(function (row) { row.splice(range.startColumn, columnCount) })
      widths.splice(range.startColumn, columnCount)
      config.layout = 'custom'
      config.widths = { unit: 'px', values: widths }
      config.columnCount = block.columnCount - columnCount
      targetColumn = Math.min(range.startColumn, config.columnCount - 1)
    } else return false
    var replacement = serializeMarkdownTableRows(rows)
    parsed.lines.splice.apply(parsed.lines, [block.start, block.end - block.start + 1].concat(replacement))
    var next = parsed.lines.join('\n')
    return commitMarkdownTableTransaction(table, next, {
      row: targetRow,
      column: targetColumn,
      restoreRange: false,
      restoreCaret: true,
      revealColumn: revealColumn,
      config: config
    })
  }

  function parseMarkdownTables(markdown) {
    return parseMarkdownTableBlocks(markdown).tables.map(function (table) { return table.rows })
  }

  function tableCellPosition(cell) {
    if (!cell || !cell.closest) return null
    var table = cell.closest('table.eyan-layout-table')
    if (!table || table.dataset.eyanTableEditable !== '1') return null
    var rows = Array.from(table.querySelectorAll('tr'))
    var row = rows.indexOf(cell.parentElement)
    var column = Array.from(cell.parentElement.querySelectorAll(':scope > th, :scope > td')).indexOf(cell)
    if (row < 0 || column < 0) return null
    return { table: table, row: row, column: column }
  }

  function normalizedTableRange(start, end) {
    if (!start || !end || start.table !== end.table) return null
    return {
      table: start.table,
      startRow: Math.min(start.row, end.row),
      endRow: Math.max(start.row, end.row),
      startColumn: Math.min(start.column, end.column),
      endColumn: Math.max(start.column, end.column)
    }
  }

  function tableCellAt(table, row, column) {
    var tableRow = table && table.querySelectorAll('tr')[row]
    return tableRow && tableRow.querySelectorAll(':scope > th, :scope > td')[column]
  }

  function removeTableRangePaint() {
    document.querySelectorAll('.eyan-table-range-selected').forEach(function (cell) {
      cell.classList.remove('eyan-table-range-selected')
    })
    document.querySelectorAll('.eyan-table-range-overlay').forEach(function (overlay) { overlay.remove() })
  }

  function clearTableRangeSelection() {
    cancelTableRangeAutoScroll()
    tableRangePointer = null
    tableRangeSelection = null
    pendingTableRangeRestore = null
    // A paste/clear transaction may still be waiting for Vditor's rerender.
    // Once the user dismisses the range (or leaves Preview), that transaction
    // must not resurrect the old selection on its next restoration pass.
    if (pendingTableTransaction) {
      pendingTableTransaction.range = null
      pendingTableTransaction.restoreRange = false
    }
    removeTableRangePaint()
  }

  function endTableSelectionForLayoutChange() {
    finishTableSelector()
    finishTableRangePointer()
    clearTableRangeSelection()
    savedTableRange = null
  }

  function paintTableRangeSelection() {
    var range = tableRangeSelection
    if (!range || !range.table || !range.table.isConnected) return
    document.querySelectorAll('.eyan-table-range-selected').forEach(function (cell) {
      cell.classList.remove('eyan-table-range-selected')
    })
    document.querySelectorAll('.eyan-table-range-overlay').forEach(function (overlay) {
      if (overlay.parentElement !== range.table && overlay.parentElement !== stickyTableHeader) overlay.remove()
    })
    var first = tableCellAt(range.table, range.startRow, range.startColumn)
    var last = tableCellAt(range.table, range.endRow, range.endColumn)
    if (!first || !last) return
    for (var row = range.startRow; row <= range.endRow; row++) {
      for (var column = range.startColumn; column <= range.endColumn; column++) {
        var cell = tableCellAt(range.table, row, column)
        if (cell) cell.classList.add('eyan-table-range-selected')
      }
    }
    var tableRect = range.table.getBoundingClientRect()
    var firstRect = first.getBoundingClientRect()
    var lastRect = last.getBoundingClientRect()
    var overlay = range.table.querySelector(':scope > .eyan-table-range-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'eyan-table-range-overlay'
      overlay.setAttribute('aria-hidden', 'true')
      range.table.appendChild(overlay)
    }
    var visibleLeft = firstRect.left
    var visibleTop = firstRect.top
    if (stickyTableHeader && stickyTableHeader.__eyanTable === range.table) {
      var headerRect = stickyTableHeader.getBoundingClientRect()
      visibleTop = Math.max(visibleTop, range.startRow === 0 ? headerRect.top : headerRect.bottom)
    }
    if (range.startColumn > 0 && range.table.__eyanTableLayout.titleColumn) {
      visibleLeft = Math.max(visibleLeft, tableCellAt(range.table, range.startRow, 0).getBoundingClientRect().right)
    }
    overlay.style.left = range.table.scrollLeft + visibleLeft - tableRect.left + 'px'
    overlay.style.top = range.table.scrollTop + visibleTop - tableRect.top + 'px'
    overlay.style.width = Math.max(0, lastRect.right - visibleLeft) + 'px'
    overlay.style.height = Math.max(0, lastRect.bottom - visibleTop) + 'px'
    overlay.style.display = lastRect.right <= visibleLeft || lastRect.bottom <= visibleTop ? 'none' : ''
  }

  function restorePendingTableRange() {
    if (pendingTableRangeRestore) {
      var reset = document.querySelector('.vditor-ir .vditor-reset')
      var table = reset && reset.querySelectorAll('table.eyan-layout-table')[pendingTableRangeRestore.tableIndex]
      if (table) {
        tableRangeSelection = {
          table: table,
          startRow: pendingTableRangeRestore.startRow,
          endRow: pendingTableRangeRestore.endRow,
          startColumn: pendingTableRangeRestore.startColumn,
          endColumn: pendingTableRangeRestore.endColumn
        }
        pendingTableRangeRestore = null
      }
    }
    if (tableRangeSelection && tableRangeSelection.table && tableRangeSelection.table.isConnected) paintTableRangeSelection()
  }

  function tableRangeCellFromPoint(x, y, table) {
    var elements = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)]
    for (var index = 0; index < elements.length; index++) {
      var cell = elements[index] && elements[index].closest && elements[index].closest('th, td')
      if (cell && cell.closest('table') === table) return cell
    }
    return null
  }

  function tableRangeCellNearPoint(x, y, table) {
    if (!table) return null
    var rect = table.getBoundingClientRect()
    if (y < rect.top || y > rect.bottom) return null
    var clampedX = Math.max(rect.left + 2, Math.min(rect.right - 2, x))
    var cell = tableRangeCellFromPoint(clampedX, y, table)
    if (cell) return cell
    var rows = Array.from(table.querySelectorAll('tr'))
    var row = rows.find(function (candidate) {
      var rowRect = candidate.getBoundingClientRect()
      return y >= rowRect.top && y <= rowRect.bottom
    })
    if (!row) return null
    var cells = row.querySelectorAll(':scope > th, :scope > td')
    return cells[x <= rect.left + rect.width / 2 ? 0 : cells.length - 1] || null
  }

  function tableRangePositionNearPoint(x, y, table) {
    if (!table) return null
    return tableCellPosition(tableRangeCellNearPoint(x, y, table))
  }

  function updateTableRangePointerPosition(x, y) {
    if (!tableRangePointer) return false
    var position = tableRangePositionNearPoint(x, y, tableRangePointer.start.table)
    if (!position || position.table !== tableRangePointer.start.table) return false
    if (!tableRangePointer.crossed && position.row === tableRangePointer.start.row && position.column === tableRangePointer.start.column) return false
    tableRangePointer.crossed = true
    tableRangePointer.current = position
    tableRangeSelection = normalizedTableRange(tableRangePointer.start, position)
    var selection = window.getSelection()
    if (selection) selection.removeAllRanges()
    paintTableRangeSelection()
    return true
  }

  function cancelTableRangeAutoScroll() {
    if (tableRangeAutoScrollFrame) cancelAnimationFrame(tableRangeAutoScrollFrame)
    tableRangeAutoScrollFrame = null
  }

  function scheduleTableRangeAutoScroll() {
    if (tableRangeAutoScrollFrame || !tableRangePointer || !tableRangePointer.crossed) return
    tableRangeAutoScrollFrame = requestAnimationFrame(runTableRangeAutoScroll)
  }

  function runTableRangeAutoScroll() {
    tableRangeAutoScrollFrame = null
    var pointer = tableRangePointer
    var table = pointer && pointer.start && pointer.start.table
    if (!pointer || !pointer.crossed || !table || !table.isConnected) return
    var rect = table.getBoundingClientRect()
    var edge = 32
    var moved = false
    var horizontalDirection = 0
    var horizontalProximity = 0
    if (pointer.clientX < rect.left + edge) {
      horizontalDirection = -1
      horizontalProximity = Math.min(1, (rect.left + edge - pointer.clientX) / edge)
    } else if (pointer.clientX > rect.right - edge) {
      horizontalDirection = 1
      horizontalProximity = Math.min(1, (pointer.clientX - (rect.right - edge)) / edge)
    }
    if (horizontalDirection && table.scrollWidth > table.clientWidth + 1) {
      var beforeLeft = table.scrollLeft
      var horizontalDelta = horizontalDirection * (4 + horizontalProximity * 12)
      table.scrollLeft = Math.max(0, Math.min(table.scrollWidth - table.clientWidth, beforeLeft + horizontalDelta))
      if (Math.abs(table.scrollLeft - beforeLeft) >= 0.5) {
        rememberTableScroll(table)
        moved = true
      }
    }
    var scroller = tableScrollContainer(table)
    if (scroller) {
      var documentScroller = scroller === document.documentElement || scroller === document.body || scroller === document.scrollingElement
      var scrollerRect = documentScroller ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect()
      var verticalDirection = 0
      var verticalProximity = 0
      if (pointer.clientY < scrollerRect.top + edge) {
        verticalDirection = -1
        verticalProximity = Math.min(1, (scrollerRect.top + edge - pointer.clientY) / edge)
      } else if (pointer.clientY > scrollerRect.bottom - edge) {
        verticalDirection = 1
        verticalProximity = Math.min(1, (pointer.clientY - (scrollerRect.bottom - edge)) / edge)
      }
      if (verticalDirection) {
        var beforeTop = Number(scroller.scrollTop) || 0
        var rows = table.querySelectorAll('tr')
        var averageRowHeight = rows.length ? Math.max(12, table.scrollHeight / rows.length) : 32
        var verticalDelta = verticalDirection * Math.min(averageRowHeight / 2, 4 + verticalProximity * 12)
        scroller.scrollTop = Math.max(0, beforeTop + verticalDelta)
        if (Math.abs((Number(scroller.scrollTop) || 0) - beforeTop) >= 0.5) moved = true
      }
    }
    if (!moved) return
    updateTableRangePointerPosition(pointer.clientX, pointer.clientY)
    scheduleStickyTableHeader()
    scheduleTableSelectorLayer()
    scheduleTableRangeAutoScroll()
  }

  function isTableRangeInteractiveTarget(target) {
    return !!(target && target.closest && target.closest('.eyan-column-resize-handle, .eyan-table-selector-handle, a, [data-type="a"], button, input, textarea, select, .eyan-copy-button, img, ' + GRAPHIC_DIAGRAM_SELECTOR))
  }

  function beginTableRangePointer(event) {
    if (state.mode !== 'preview' || event.button !== 0 || isTableRangeInteractiveTarget(event.target)) return
    var cell = event.target.closest && event.target.closest('.vditor-ir table.eyan-layout-table[data-eyan-table-editable="1"] th, .vditor-ir table.eyan-layout-table[data-eyan-table-editable="1"] td')
    var position = tableCellPosition(cell)
    if (!position) {
      if (!event.target.closest || !event.target.closest('.eyan-table-range-overlay')) clearTableRangeSelection()
      return
    }
    removeTableRangePaint()
    tableRangeSelection = null
    cancelTableRangeAutoScroll()
    tableRangePointer = { start: position, current: position, crossed: false, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY }
  }

  function moveTableRangePointer(event) {
    if (!tableRangePointer || tableResizeSession) return
    tableRangePointer.clientX = event.clientX
    tableRangePointer.clientY = event.clientY
    if (updateTableRangePointerPosition(event.clientX, event.clientY) || tableRangePointer.crossed) {
      event.preventDefault()
      event.stopPropagation()
    }
    cancelTableRangeAutoScroll()
    scheduleTableRangeAutoScroll()
  }

  function finishTableRangePointer(event) {
    if (!tableRangePointer) return
    if (event && tableRangePointer.pointerId != null && event.pointerId != null && event.pointerId !== tableRangePointer.pointerId) return
    if (tableRangePointer.crossed) {
      suppressTableRangeClick = true
      setTimeout(function () { suppressTableRangeClick = false }, 0)
    }
    cancelTableRangeAutoScroll()
    tableRangePointer = null
  }

  function selectedTableCells(range) {
    var rows = []
    if (!range || !range.table || !range.table.isConnected) return rows
    for (var row = range.startRow; row <= range.endRow; row++) {
      var cells = []
      for (var column = range.startColumn; column <= range.endColumn; column++) {
        var cell = tableCellAt(range.table, row, column)
        cells.push(cell ? tableCellPlainText(cell) : '')
      }
      rows.push(cells)
    }
    return rows
  }

  function escapeClipboardHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function copyTableRange(event) {
    if (!tableRangeSelection || !event.clipboardData) return
    var matrix = selectedTableCells(tableRangeSelection)
    if (!matrix.length) return
    var html = '<table><tbody>' + matrix.map(function (row) {
      return '<tr>' + row.map(function (cell) { return '<td>' + escapeClipboardHtml(cell).replace(/\n/g, '<br>') + '</td>' }).join('') + '</tr>'
    }).join('') + '</tbody></table>'
    var tsv = matrix.map(function (row) {
      return row.map(function (cell) { return String(cell || '').replace(/\r?\n/g, '<br>') }).join('\t')
    }).join('\n')
    event.clipboardData.setData('text/html', html)
    event.clipboardData.setData('text/plain', tsv)
    event.preventDefault()
    event.stopPropagation()
  }

  function htmlTableCellText(cell) {
    var output = ''
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        output += node.nodeValue || ''
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      if (node !== cell && node.tagName === 'TABLE') return
      if (node.tagName === 'BR') {
        output += '\n'
        return
      }
      var block = /^(?:P|DIV|LI)$/i.test(node.tagName)
      Array.from(node.childNodes).forEach(visit)
      if (block && output && output[output.length - 1] !== '\n') output += '\n'
    }
    Array.from(cell.childNodes).forEach(visit)
    return output.replace(/\n+$/, '')
  }

  function matrixFromClipboardHtml(html) {
    if (!html || typeof DOMParser === 'undefined') return null
    var documentValue = new DOMParser().parseFromString(html, 'text/html')
    var table = documentValue.querySelector('table')
    if (!table) return null
    var rows = Array.from(table.querySelectorAll('tr')).filter(function (row) { return row.closest('table') === table })
    var matrix = rows.map(function (row) {
      return Array.from(row.querySelectorAll(':scope > th, :scope > td')).map(htmlTableCellText)
    }).filter(function (row) { return row.length })
    return matrix.length ? matrix : null
  }

  function matrixFromClipboardText(text) {
    text = String(text == null ? '' : text).replace(/\r\n?/g, '\n')
    if (text.indexOf('\t') >= 0) {
      var lines = text.split('\n')
      if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
      return lines.map(function (line) { return line.split('\t').map(function (cell) { return cell.replace(/<br\s*\/?>/gi, '\n') }) })
    }
    var parsed = parseMarkdownTableBlocks(text)
    if (parsed.tables.length) {
      return parsed.tables[0].rows.map(function (row) {
        return row.map(function (cell) { return cell.replace(/<br\s*\/?>/gi, '\n') })
      })
    }
    return null
  }

  function markdownTableCellValue(value) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/(^|[^\\])\|/g, '$1\\|')
      .replace(/\n/g, '<br>')
      .trim()
  }

  function applyTableRangePaste(matrix, destination) {
    if (!matrix || !matrix.length || !destination || !destination.table) return false
    var editor = getEditor()
    if (!editor || typeof editor.getValue !== 'function' || typeof editor.setValue !== 'function') return false
    var reset = document.querySelector('.vditor-ir .vditor-reset')
    var tableIndex = reset ? Array.from(reset.querySelectorAll('table.eyan-layout-table')).indexOf(destination.table) : -1
    if (tableIndex < 0) return false
    var parsed = parseMarkdownTableBlocks(editor.getValue())
    var block = parsed.tables[tableIndex]
    if (!block) return false
    var maxRows = destination.endRow - destination.startRow + 1
    var maxColumns = destination.endColumn - destination.startColumn + 1
    var changed = false
    for (var sourceRow = 0; sourceRow < Math.min(matrix.length, maxRows); sourceRow++) {
      var source = matrix[sourceRow] || []
      var targetRow = destination.startRow + sourceRow
      if (!block.rows[targetRow]) break
      for (var sourceColumn = 0; sourceColumn < Math.min(source.length, maxColumns); sourceColumn++) {
        var targetColumn = destination.startColumn + sourceColumn
        if (targetColumn >= block.columnCount) break
        block.rows[targetRow][targetColumn] = markdownTableCellValue(source[sourceColumn])
        changed = true
      }
    }
    if (!changed) return false
    block.rows.forEach(function (row, rowIndex) {
      var lineIndex = rowIndex === 0 ? block.start : block.start + rowIndex + 1
      parsed.lines[lineIndex] = '| ' + row.join(' | ') + ' |'
    })
    var next = parsed.lines.join('\n')
    var restoreRange = destination.restoreSelectedRange !== false
    if (!restoreRange) {
      tableRangeSelection = null
      pendingTableRangeRestore = null
      removeTableRangePaint()
    }
    var committed = commitMarkdownTableTransaction(destination.table, next, {
      row: destination.startRow,
      column: destination.startColumn,
      range: restoreRange ? destination : null,
      restoreRange: restoreRange,
      restoreCaret: !restoreRange,
      preserveVisualAnchor: true
    })
    return committed
  }

  function pasteTextIntoTableCell(cell, text) {
    var selection = window.getSelection()
    if (!cell || !selection || !selection.rangeCount) return false
    var range = selection.getRangeAt(0)
    if (!cell.contains(range.startContainer) || !cell.contains(range.endContainer)) return false
    var editor = getEditor()
    if (!editor || !editor.vditor) return false
    var internal = editor.vditor
    // Keep native inline content and the exact selection. Parsing these lines
    // as Markdown blocks can insert paragraphs after the table or new rows.
    pendingTableTransaction = null
    pendingTableRangeRestore = null
    captureTableInputViewport(cell)
    internal.undo.addToUndoStack(internal)
    if (isVisuallyEmptyTableCell(cell)) range.selectNodeContents(cell)
    range.deleteContents()
    var fragment = document.createDocumentFragment()
    String(text).replace(/\r\n?/g, '\n').split('\n').forEach(function (line, index) {
      if (index) fragment.appendChild(document.createElement('br'))
      fragment.appendChild(document.createTextNode(line))
    })
    var end = fragment.lastChild
    range.insertNode(fragment)
    range.setStartAfter(end)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    cell.classList.remove('eyan-empty-table-cell')
    savedTableRange = range.cloneRange()
    cell.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: text }))
    internal.undo.addToUndoStack(internal)
    state.documentText = editor.getValue()
    if (window.vscode) window.vscode.postMessage({ command: 'edit', content: state.documentText })
    scheduleEnhance()
    return true
  }

  function pasteTableRange(event) {
    if (state.mode !== 'preview' || !event.clipboardData) return
    var destination = tableRangeSelection
    var restoreSelectedRange = !!destination
    var targetCell = event.target && event.target.closest && event.target.closest('.vditor-ir table.eyan-layout-table[data-eyan-table-editable="1"] th, .vditor-ir table.eyan-layout-table[data-eyan-table-editable="1"] td')
    // Clipboard events can target the contenteditable root rather than its
    // selected cell. Prefer an explicit cell target, otherwise use Selection.
    if (!targetCell) targetCell = activeTableEditingCell()
    if (!destination) {
      var position = tableCellPosition(targetCell)
      if (!position) return
      var rows = position.table.querySelectorAll('tr')
      destination = {
        table: position.table,
        startRow: position.row,
        endRow: rows.length - 1,
        startColumn: position.column,
        endColumn: renderedTableColumnCount(position.table) - 1,
      }
    }
    if (!restoreSelectedRange) destination.restoreSelectedRange = false
    var matrix = matrixFromClipboardHtml(event.clipboardData.getData('text/html'))
    var plainText = event.clipboardData.getData('text/plain')
    if (!matrix) matrix = matrixFromClipboardText(plainText)
    // Plain text follows the native DOM Range while a cell is being edited.
    // A persistent cell-range selection is a different state: pasting there
    // intentionally replaces the selected anchor cell (1x1 replaces the full
    // cell; a larger range keeps the existing "source-sized" fill behavior).
    if (!matrix && restoreSelectedRange) matrix = [[plainText]]
    if (!matrix) {
      // Image/file-only clipboard payloads still belong to the upload handler.
      if (!plainText) return
      if (pasteTextIntoTableCell(targetCell, plainText)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      return
    }
    if (!applyTableRangePaste(matrix, destination)) return
    event.preventDefault()
    event.stopPropagation()
  }

  function clearSelectedTableRange() {
    var destination = tableRangeSelection
    if (!destination) return false
    var rowCount = destination.endRow - destination.startRow + 1
    var columnCount = destination.endColumn - destination.startColumn + 1
    var matrix = Array.from({ length: rowCount }, function () { return Array(columnCount).fill('') })
    return applyTableRangePaste(matrix, destination)
  }

  function defaultTableLayout(columnCount) {
    return {
      version: 1,
      layout: 'auto',
      headerRow: true,
      titleColumn: false,
      widths: null,
      columnCount: Math.max(1, Number(columnCount) || 1)
    }
  }

  function stripTableLayoutMetadata(markdown) {
    if (String(markdown || '').indexOf('sightmd-table:') < 0) return String(markdown || '')
    return String(markdown || '').replace(/^\s*<!--\s*sightmd-table:\s*\{.*\}\s*-->\s*(?:\n|$)/gm, '')
  }

  function hasTableBreakToken(source) {
    return /<br\s*\/?>/i.test(String(source || ''))
  }

  function withoutTableBreakTokens(source) {
    return String(source || '').replace(/<br\s*\/?>/gi, '').replace(/\s+/g, ' ').trim()
  }

  function restoreTableBreaksFromPrevious(current, previous) {
    if (!previous || !hasTableBreakToken(previous)) return current
    var currentParsed = parseMarkdownTableBlocks(current)
    var previousParsed = parseMarkdownTableBlocks(previous)
    currentParsed.tables.forEach(function (table, tableIndex) {
      var previousTable = previousParsed.tables[tableIndex]
      if (!previousTable) return
      table.rows.forEach(function (row, rowIndex) {
        var previousRow = previousTable.rows[rowIndex]
        if (!previousRow) return
        var changed = false
        row.forEach(function (cell, cellIndex) {
          var previousCell = previousRow[cellIndex]
          if (!hasTableBreakToken(previousCell) || hasTableBreakToken(cell)) return
          if (withoutTableBreakTokens(previousCell) !== withoutTableBreakTokens(cell)) return
          row[cellIndex] = previousCell
          changed = true
        })
        if (!changed) return
        var lineIndex = rowIndex === 0 ? table.start : table.start + rowIndex + 1
        currentParsed.lines[lineIndex] = '| ' + row.join(' | ') + ' |'
      })
    })
    return currentParsed.lines.join('\n')
  }

  function ensureTableBreakGetValue() {
    var editor = getEditor()
    if (!editor || typeof editor.getValue !== 'function' || editor.__eyanTableBreakGetValue) return
    var originalGetValue = editor.getValue.bind(editor)
    editor.getValue = function () {
      var current = originalGetValue()
      var restored = restoreTableBreaksFromPrevious(current, state.documentText)
      restored = stripTableLayoutMetadata(restored)
      state.documentText = restored
      return restored
    }
    editor.__eyanTableBreakGetValue = true
  }

  function replaceTableBreakTokens(source, token) {
    var text = String(source || '')
    var output = ''
    var count = 0
    var codeFence = 0
    for (var i = 0; i < text.length;) {
      if (text[i] === '`') {
        var run = 1
        while (i + run < text.length && text[i + run] === '`') run += 1
        output += text.slice(i, i + run)
        if (!codeFence) codeFence = run
        else if (codeFence === run) codeFence = 0
        i += run
        continue
      }
      if (!codeFence && text[i] === '<') {
        var match = text.slice(i).match(/^<br\s*\/?>/i)
        var backslashes = 0
        for (var j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes += 1
        if (match && backslashes % 2 === 0) {
          output += token
          count += 1
          i += match[0].length
          continue
        }
      }
      output += text[i]
      i += 1
    }
    return { value: output, count: count }
  }

  function replaceTextTokenWithBreaks(root, token) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    var nodes = []
    while (walker.nextNode()) {
      if ((walker.currentNode.nodeValue || '').indexOf(token) >= 0) nodes.push(walker.currentNode)
    }
    nodes.forEach(function (node) {
      var parts = node.nodeValue.split(token)
      var fragment = document.createDocumentFragment()
      parts.forEach(function (part, index) {
        if (part) fragment.appendChild(document.createTextNode(part))
        if (index < parts.length - 1) {
          var br = document.createElement('br')
          br.setAttribute('data-eyan-table-break', '1')
          fragment.appendChild(br)
        }
      })
      node.parentNode.replaceChild(fragment, node)
    })
  }

  function renderSplitTableCell(cell, source, tableIndex, rowIndex, cellIndex) {
    var editor = getEditor()
    var lute = editor && editor.vditor && editor.vditor.lute
    if (!lute || typeof lute.Md2HTML !== 'function') return
    var token = 'EYANSIGHTMDBREAK' + tableIndex + 'X' + rowIndex + 'X' + cellIndex + 'TOKEN'
    var replaced = replaceTableBreakTokens(source, token)
    if (!replaced.count) return
    var holder = document.createElement('div')
    holder.innerHTML = lute.Md2HTML(replaced.value)
    replaceTextTokenWithBreaks(holder, token)
    var content = holder.children.length === 1 && holder.firstElementChild.tagName === 'P' ? holder.firstElementChild : holder
    while (cell.firstChild) cell.removeChild(cell.firstChild)
    Array.from(content.childNodes).forEach(function (node) { cell.appendChild(node.cloneNode(true)) })
    cell.dataset.eyanTableBreakSource = source
  }

  function enhanceSplitTableBreaks() {
    if (state.mode !== 'split') return
    var reset = document.querySelector('.vditor-preview .vditor-reset')
    if (!reset) return
    var editor = getEditor()
    var markdown = state.documentText || (editor && typeof editor.getValue === 'function' ? editor.getValue() : '')
    var sourceTables = parseMarkdownTables(markdown)
    Array.from(reset.querySelectorAll('table')).forEach(function (table, tableIndex) {
      var sourceRows = sourceTables[tableIndex]
      if (!sourceRows) return
      Array.from(table.querySelectorAll('tr')).forEach(function (row, rowIndex) {
        var sourceCells = sourceRows[rowIndex]
        if (!sourceCells) return
        Array.from(row.querySelectorAll(':scope > th, :scope > td')).forEach(function (cell, cellIndex) {
          var source = sourceCells[cellIndex]
          if (typeof source !== 'string') return
          if (cell.dataset.eyanTableBreakSource === source) return
          renderSplitTableCell(cell, source, tableIndex, rowIndex, cellIndex)
        })
      })
    })
  }

  // Lute pads a setext underline out to the width of its heading text when it
  // serializes. In the left pane that rewrites dashes the author typed: break
  // the opening --- of a front matter block and the closing --- stops being a
  // fence, becomes a setext underline for the line above it, and grows into a
  // long dash run on the next render. Nothing upstream exposes a switch for it,
  // so trim each underline back to what the document actually holds.
  function splitDashRuns(text) {
    return String(text || '').replace(/\r\n/g, '\n').split('\n')
  }

  // Padding changes an underline's width, never the line count, so the line
  // index is a stable key between the pre-render snapshot and the render.
  // Matching markers by ordinal instead would pair them with the wrong source
  // line and truncate fences the author never touched.
  function splitSourceLineIndex(source, marker) {
    var walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
    var newlines = 0
    while (walker.nextNode()) {
      var node = walker.currentNode
      if (marker.contains(node)) break
      var value = node.nodeValue || ''
      for (var i = 0; i < value.length; i++) if (value.charCodeAt(i) === 10) newlines++
    }
    return newlines
  }

  function normalizeSplitSetextUnderlines() {
    if (state.mode !== 'split') return false
    var source = document.querySelector('.vditor-sv')
    if (!source) return false
    // Captured from the raw pane text before Vditor re-rendered it, so this is
    // what the author typed rather than the serializer's padded output. It is
    // valid only for the render of the edit that produced it: consume it once,
    // and ignore it once stale, or a later unrelated render would "restore"
    // dashes from the wrong edit and truncate a fence the author left alone.
    var documentRuns = splitSetextRuns
    splitSetextRuns = null
    if (!documentRuns || !documentRuns.length) return false
    if (Date.now() - lastSplitInputAt > 1000) return false
    var markers = Array.from(source.querySelectorAll('span[data-type="heading-marker"]'))
      .filter(function (marker) { return /^\s*(-{3,}|={3,})\s*$/.test(marker.textContent || '') })
    if (!markers.length) return false
    var changed = false
    markers.forEach(function (marker) {
      var current = (marker.textContent || '').trim()
      var intended = (documentRuns[splitSourceLineIndex(source, marker)] || '').trim()
      // Only shrink a padded run back to the author's own shorter run of the
      // same character. A marker they really typed long, or one whose source
      // line is not a dash run at all, is left exactly as it is.
      if (!/^(-+|=+)$/.test(intended)) return
      if (intended[0] !== current[0] || intended.length >= current.length) return
      marker.textContent = intended
      changed = true
    })
    return changed
  }

  function enhanceSplitSourceTableBreaks() {
    if (state.mode !== 'split') return
    var source = document.querySelector('.vditor-sv')
    if (!source) return
    var sourceTables = parseMarkdownTables(state.documentText || '')
    Array.from(source.querySelectorAll('span[data-type="table"]')).forEach(function (tableNode, tableIndex) {
      var table = sourceTables[tableIndex]
      if (!table) return
      var tokens = []
      table.forEach(function (row) {
        row.forEach(function (cell) {
          var matches = String(cell).match(/<br\s*\/?>/gi)
          if (matches) tokens.push.apply(tokens, matches)
        })
      })
      Array.from(tableNode.querySelectorAll(':scope > br')).forEach(function (br, index) {
        br.parentNode.replaceChild(document.createTextNode(tokens[index] || '<br>'), br)
      })
    })
  }

  function enhanceTableBreaks() {
    ensureTableBreakGetValue()
    enhanceInlineTableBreaks()
    enhanceSplitSourceTableBreaks()
    enhanceSplitTableBreaks()
  }

  function cloneTableLayout(value) {
    return {
      version: 1,
      layout: value.layout,
      headerRow: !!value.headerRow,
      titleColumn: !!value.titleColumn,
      widths: value.widths ? { unit: value.widths.unit, values: value.widths.values.slice() } : null,
      columnCount: value.columnCount
    }
  }

  function getRenderedTableSurfaces() {
    if (state.mode === 'split') {
      var splitPreview = document.querySelector('.vditor-preview .vditor-reset')
      return splitPreview ? [{ root: splitPreview, editable: false }] : []
    }
    var ir = document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
    return ir ? [{ root: ir, editable: state.mode === 'preview' }] : []
  }

  function renderedTableColumnCount(table) {
    var row = table.querySelector('tr')
    return row ? row.querySelectorAll(':scope > th, :scope > td').length : 0
  }


  function isVisuallyEmptyTableCell(cell) {
    if (!cell || !/^(TH|TD)$/.test(cell.tagName)) return false
    return !tableCellPlainText(cell).replace(/[\u200B\uFEFF\s]/g, '')
  }

  function normalizeEmptyTableCaret(cell) {
    if (tableCompositionCell) return false
    if (!cell || !cell.classList.contains('eyan-empty-table-cell') || !isVisuallyEmptyTableCell(cell)) return false
    var selection = window.getSelection()
    if (!selection) return false
    try {
      var range = document.createRange()
      var editableText = Array.from(cell.childNodes).find(function (node) {
        return node.nodeType === Node.TEXT_NODE && !String(node.nodeValue || '').replace(/[\u200B\uFEFF\s]/g, '')
      })
      if (!cell.querySelector(':scope > br')) cell.appendChild(document.createElement('br'))
      if (editableText) range.setStart(editableText, 0)
      else range.setStart(cell, 0)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      savedTableRange = range.cloneRange()
      savedInsertRange = range.cloneRange()

      return true
    } catch (_) {
      return false
    }
  }

  function tableAvailableWidth(table) {
    var parent = table.parentElement
    var width = 0
    if (parent) {
      var style = getComputedStyle(parent)
      width = parent.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
    }
    if (!width) width = table.clientWidth || 640
    return Math.max(1, width)
  }

  function tableSessionIndex(table) {
    var index = table && Number(table.dataset.eyanTableIndex)
    return Number.isFinite(index) && index >= 0 ? index : -1
  }

  function tableSurfaceViewportTop(table) {
    var surface = table && table.closest && table.closest('.vditor-reset')
    if (!surface) return 0
    return Math.max(0, surface.getBoundingClientRect().top)
  }

  function captureTableGeometry(table) {
    if (!table || !table.isConnected) return null
    var tableRect = table.getBoundingClientRect()
    var widths = (table.__eyanPixelWidths || []).slice()
    if (!widths.length) {
      var firstRow = table.querySelector('tr')
      widths = firstRow ? Array.from(firstRow.querySelectorAll(':scope > th, :scope > td')).map(function (cell) { return cell.getBoundingClientRect().width }) : []
    }
    var contentLeft = tableRect.left - (Number(table.scrollLeft) || 0)
    var offset = 0
    var columnBounds = widths.map(function (width, column) {
      var left = contentLeft + offset
      offset += width
      return { column: column, left: left, right: contentLeft + offset, width: width }
    })
    if (table.__eyanTableLayout && table.__eyanTableLayout.titleColumn && columnBounds.length) {
      var fixedRight = tableRect.left + columnBounds[0].width
      columnBounds[0].left = tableRect.left
      columnBounds[0].right = fixedRight
      columnBounds.slice(1).forEach(function (column) { column.left = Math.max(fixedRight, column.left) })
    }
    var rowBounds = Array.from(table.querySelectorAll('tr')).map(function (row, index) {
      var rect = row.getBoundingClientRect()
      return { row: index, top: rect.top, bottom: rect.bottom, height: rect.height }
    })
    var snapshot = {
      table: table,
      tableIndex: tableSessionIndex(table),
      tableRect: tableRect,
      visibleRect: {
        left: Math.max(0, tableRect.left),
        right: Math.min(window.innerWidth, tableRect.right),
        top: Math.max(tableSurfaceViewportTop(table), tableRect.top),
        bottom: Math.min(window.innerHeight, tableRect.bottom)
      },
      scrollLeft: Number(table.scrollLeft) || 0,
      columnBounds: columnBounds,
      rowBounds: rowBounds,
      headerHeight: rowBounds[0] ? rowBounds[0].height : 0,
      topRailHeight: TABLE_TOP_RAIL_HEIGHT,
      leftRailWidth: TABLE_LEFT_RAIL_WIDTH
    }
    table.__eyanGeometrySnapshot = snapshot
    return snapshot
  }

  function rememberTableScroll(table) {
    var index = tableSessionIndex(table)
    if (index < 0) return
    var left = Math.max(0, Number(table.scrollLeft) || 0)
    tableScrollSessions[index] = left
    // User scrolling and the intentional reveal of a newly inserted column
    // both supersede the viewport captured at transaction start.
    if (pendingTableTransaction && pendingTableTransaction.tableIndex === index) pendingTableTransaction.scrollLeft = left
  }

  function markTableScrollIntent(event) {
    var table = event && event.target && event.target.closest && event.target.closest('table.eyan-layout-table')
    if (!table) return
    if (event.type === 'wheel') table.__eyanScrollIntentOnce = true
    else {
      table.__eyanScrollPointerActive = true
      activeTableScrollIntent = table
    }
  }

  function finishTableScrollIntent() {
    if (!activeTableScrollIntent) return
    rememberTableScroll(activeTableScrollIntent)
    activeTableScrollIntent.__eyanScrollPointerActive = false
    activeTableScrollIntent = null
  }

  function restoreTableScroll(table) {
    var index = tableSessionIndex(table)
    if (index < 0 || !Object.prototype.hasOwnProperty.call(tableScrollSessions, index)) return
    var maximum = Math.max(0, table.scrollWidth - table.clientWidth)
    var left = Math.max(0, Math.min(maximum, tableScrollSessions[index]))
    table.scrollLeft = left
    tableScrollSessions[index] = left
  }

  function tableCellPlainText(cell) {
    if (!cell) return ''
    var output = ''
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        output += node.nodeValue || ''
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      if (node.classList.contains('eyan-column-resize-handle')) return
      if (node.tagName === 'BR' || node.classList.contains('eyan-table-line-break')) {
        output += '\n'
        return
      }
      if (node.hidden || getComputedStyle(node).display === 'none') return
      Array.from(node.childNodes).forEach(visit)
    }
    Array.from(cell.childNodes).forEach(visit)
    return output.replace(/[\u200B\uFEFF]/g, '')
  }

  function captureTableInputViewport(cell) {
    var table = cell && cell.closest && cell.closest('table.eyan-layout-table')
    if (!table) {
      tableInputViewportLock = null
      return
    }
    var row = cell.parentElement
    var scroller = tableScrollContainer(table)
    tableInputViewportLock = {
      table: table,
      row: row,
      tableIndex: renderedTableIndex(table),
      rowIndex: Array.from(table.querySelectorAll('tr')).indexOf(row),
      scrollLeft: table.scrollLeft,
      rowHeight: row.getBoundingClientRect().height,
      scroller: scroller,
      scrollTop: scroller ? Number(scroller.scrollTop) || 0 : 0,
      expires: Date.now() + 180
    }
  }

  function scheduleTableInputViewportRestore() {
    if (tableInputViewportFrame) cancelAnimationFrame(tableInputViewportFrame)
    tableInputViewportFrame = requestAnimationFrame(function () {
      tableInputViewportFrame = null
      var lock = tableInputViewportLock
      if (!lock || Date.now() > lock.expires || !lock.scroller) return
      var table = document.querySelectorAll('.vditor-ir table.eyan-layout-table')[lock.tableIndex]
      var row = table && table.querySelectorAll('tr')[lock.rowIndex]
      if (!row) return
      var heightChanged = Math.abs(row.getBoundingClientRect().height - lock.rowHeight) > 1
      if (!heightChanged && Math.abs((Number(lock.scroller.scrollTop) || 0) - lock.scrollTop) > 0.5) lock.scroller.scrollTop = lock.scrollTop
      table.scrollLeft = lock.scrollLeft
      if (!lock.restoredFrame) {
        lock.restoredFrame = true
        scheduleTableInputViewportRestore()
      } else if (tableInputViewportLock === lock) tableInputViewportLock = null
    })
  }

  function measuredCharacterWidth(character, context, fontSize) {
    if (character === '\t') return fontSize * 2
    if (context) return context.measureText(character).width
    return /[\u2E80-\u9FFF\uF900-\uFAFF]/.test(character) ? fontSize : fontSize * 0.55
  }

  function wrappedTableLineCount(lines, contentWidth) {
    var capacity = Math.max(1, contentWidth)
    return lines.reduce(function (total, line) {
      if (!line.length) return total + 1
      var count = 1
      var used = 0
      var pendingSpace = 0
      line.forEach(function (token) {
        if (token.space) { pendingSpace = used ? token.width : 0; return }
        if (used > 0 && used + pendingSpace + token.width > capacity) {
          count += 1
          used = 0
          pendingSpace = 0
        }
        if (used) used += pendingSpace
        pendingSpace = 0
        if (token.width <= capacity) used += token.width
        else token.characters.forEach(function (width) {
          if (used && used + width > capacity) { count += 1; used = 0 }
          used += width
        })
      })
      return total + count
    }, 0)
  }

  function tableWrappingModel(table) {
    var canvas = document.createElement('canvas')
    var context = canvas.getContext && canvas.getContext('2d')
    var measurements = new Map()
    var rows = Array.from(table.querySelectorAll('tr')).map(function (row) {
      return Array.from(row.querySelectorAll(':scope > th, :scope > td')).map(function (cell) {
        var style = getComputedStyle(cell)
        var fontSize = parseFloat(style.fontSize) || 13
        var lines = [[]]
        var textLength = 0
        var lineHeight = parseFloat(style.lineHeight) || fontSize * 1.6
        function visit(node, inheritedStyle) {
          if (node.nodeType === Node.TEXT_NODE) {
            var text = (node.nodeValue || '').replace(/[\u200B\uFEFF]/g, '')
            var font = [inheritedStyle.fontStyle, inheritedStyle.fontWeight, inheritedStyle.fontSize, inheritedStyle.fontFamily].join(' ')
            var size = parseFloat(inheritedStyle.fontSize) || fontSize
            lineHeight = Math.max(lineHeight, parseFloat(inheritedStyle.lineHeight) || size * 1.6)
            if (context) context.font = font
            // Preserve word boundaries; CJK can break between characters. Attach
            // closing punctuation to the preceding CJK character where possible.
            text.split('\n').forEach(function (line, index) {
              if (index) lines.push([])
              var words = line.match(/[ \t]+|[\u2E80-\u9FFF\uF900-\uFAFF][，。！？、；：）》」』】]*|[^ \t\u2E80-\u9FFF\uF900-\uFAFF]+/g) || []
              words.forEach(function (word) {
                var space = /^[ \t]+$/.test(word)
                if (space) word = ' '
                var key = font + '\n' + word
                var measured = measurements.get(key)
                if (!measured) {
                  var characters = Array.from(word).map(function (character) { return Math.max(0, measuredCharacterWidth(character, context, size)) })
                  measured = { width: context ? context.measureText(word).width : characters.reduce(function (a, b) { return a + b }, 0), characters: characters, space: space }
                  measurements.set(key, measured)
                }
                lines[lines.length - 1].push(measured)
                if (!space) textLength += word.length
              })
            })
            return
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return
          if (node.tagName === 'BR' || node.classList.contains('eyan-table-line-break')) { lines.push([]); return }
          var childStyle = getComputedStyle(node)
          if (node.hidden || childStyle.display === 'none' || node.classList.contains('vditor-ir__marker')) return
          Array.from(node.childNodes).forEach(function (child) { visit(child, childStyle) })
        }
        Array.from(cell.childNodes).forEach(function (node) { visit(node, style) })
        var naturalWidth = lines.reduce(function (maximum, line) {
          return Math.max(maximum, line.reduce(function (sum, token) { return sum + token.width }, 0))
        }, 0)
        return {
          lines: lines,
          padding: (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0),
          fontSize: fontSize,
          lineHeight: lineHeight,
          verticalPadding: (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0),
          naturalWidth: naturalWidth,
          textLength: textLength
        }
      })
    })
    return { rows: rows }
  }

  function tableColumnCandidates(model, columnCount) {
    model.curves = []
    return Array.from({ length: columnCount }, function (_, column) {
      var cells = model.rows.map(function (row) { return row[column] }).filter(Boolean)
      var fontSize = cells.length ? cells.reduce(function (sum, cell) { return sum + cell.fontSize }, 0) / cells.length : 13
      var chrome = cells.length ? Math.max.apply(Math, cells.map(function (cell) { return cell.padding })) : 28
      var natural = cells.reduce(function (maximum, cell) { return Math.max(maximum, cell.naturalWidth + cell.padding) }, chrome)
      var minimum = Math.ceil(Math.max(fontSize * 3 + chrome, Math.min(fontSize * 5 + chrome, natural)))
      var maximum = Math.ceil(Math.max(minimum, Math.min(fontSize * 32 + chrome, natural + fontSize)))
      if (!cells.some(function (cell) { return cell.textLength > 0 })) maximum = minimum
      var step = Math.max(4, fontSize * 0.5)
      var candidates = [minimum]
      function costAt(width) {
        return model.rows.map(function (row) {
          var cell = row[column]
          if (!cell) return { height: 0, wrap: 0 }
          var count = wrappedTableLineCount(cell.lines, width - cell.padding)
          return { height: Math.max(40, count * cell.lineHeight + cell.verticalPadding), wrap: Math.max(0, count - 1) * cell.lineHeight }
        })
      }
      var costs = [costAt(minimum)]
      var previousSignature = JSON.stringify(costs[0])
      for (var width = minimum + step; width < maximum; width += step) {
        var rounded = Math.round(width * 100) / 100
        var cost = costAt(rounded)
        var signature = JSON.stringify(cost)
        if (signature !== previousSignature) {
          candidates.push(rounded)
          costs.push(cost)
          previousSignature = signature
        }
      }
      if (maximum > candidates[candidates.length - 1] + 0.25) {
        var last = costAt(maximum)
        if (JSON.stringify(last) !== previousSignature) { candidates.push(maximum); costs.push(last) }
      }
      model.curves.push(costs)
      return candidates
    })
  }

  function tableWidthFrontier(model, candidates) {
    var indices = candidates.map(function () { return 0 })
    var widths = candidates.map(function (values) { return values[0] })
    function lossAt(column, candidate) {
      var loss = 0
      for (var row = 0; row < model.rows.length; row++) {
        var height = 0
        for (var col = 0; col < candidates.length; col++) {
          var cost = model.curves[col][col === column ? candidate : indices[col]][row]
          height = Math.max(height, cost.height)
          loss += cost.wrap * 0.15
        }
        loss += height
      }
      return loss
    }
    var loss = lossAt(-1, -1)
    var frontier = [{ widths: widths.slice(), width: widths.reduce(function (sum, value) { return sum + value }, 0), loss: loss }]
    var remaining = candidates.reduce(function (sum, values) { return sum + Math.max(0, values.length - 1) }, 0)
    while (remaining-- > 0) {
      var best = null
      candidates.forEach(function (values, column) {
        for (var nextIndex = indices[column] + 1; nextIndex < values.length; nextIndex++) {
          var nextLoss = lossAt(column, nextIndex)
          var pixels = values[nextIndex] - widths[column]
          var gain = loss - nextLoss
          if (gain <= 1e-9) continue
          var score = pixels > 0 ? gain / pixels : 0
          if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && pixels < best.pixels)) {
            best = { column: column, index: nextIndex, loss: nextLoss, score: score, pixels: pixels }
          }
          if (gain > 0) break
        }
      })
      if (!best) break
      indices[best.column] = best.index
      widths[best.column] = candidates[best.column][best.index]
      loss = best.loss
      frontier.push({ widths: widths.slice(), width: widths.reduce(function (sum, value) { return sum + value }, 0), loss: loss })
      if (indices.every(function (index, column) { return index >= candidates[column].length - 1 })) break
    }
    return frontier
  }

  function chooseTableReadingWidths(frontier, availableWidth) {
    if (!frontier.length) return []
    var best = frontier[0]
    var bestCost = Infinity
    frontier.forEach(function (point) {
      // Free space within the page has no reading cost. Beyond the viewport,
      // additional horizontal travel must buy a corresponding height saving.
      // Entering horizontal navigation has a cost of its own: a tiny overflow
      // must not win just to save one wrapped line. Beyond that, travel grows
      // continuously; there is no special branch at the minimum column widths.
      var travel = Math.max(1, point.width / Math.max(1, availableWidth))
      var cost = point.loss * Math.pow(travel, 1.25) * (point.width > availableWidth + 0.5 ? 1.15 : 1)
      if (cost < bestCost - 1e-7 || (Math.abs(cost - bestCost) <= 1e-7 && point.width < best.width)) {
        best = point
        bestCost = cost
      }
    })
    return best.widths.slice()
  }

  function measureAutomaticColumnWidths(table, availableWidth) {
    var columnCount = renderedTableColumnCount(table)
    if (!columnCount) return []
    var signature = Array.from(table.querySelectorAll('th, td')).map(function (cell) {
      var style = getComputedStyle(cell)
      return [cell.innerHTML, style.font, style.lineHeight, style.padding, style.borderWidth].join('\u0001')
    }).join('\u0002')
    var profile = table.__eyanReadingProfile
    if (!profile || profile.signature !== signature) {
      var model = tableWrappingModel(table)
      var candidates = tableColumnCandidates(model, columnCount)
      profile = table.__eyanReadingProfile = { signature: signature, frontier: tableWidthFrontier(model, candidates) }
    }
    return chooseTableReadingWidths(profile.frontier, availableWidth).map(function (width) { return Math.round(width * 100) / 100 })
  }

  function tablePixelWidths(table, config) {
    var available = tableAvailableWidth(table)
    if (config.widths && config.widths.values.length === config.columnCount) {
      if (config.widths.unit === 'px') return config.widths.values.slice()
      var sum = config.widths.values.reduce(function (total, value) { return total + value }, 0) || 100
      return config.widths.values.map(function (value) { return config.layout === 'fit' ? available * value / sum : Math.max(64, available * value / sum) })
    }
    return measureAutomaticColumnWidths(table, available)
  }

  function applyTableLayout(table, config) {
    if (!table || !config) return
    var columnCount = renderedTableColumnCount(table)
    if (!columnCount) return
    config.columnCount = columnCount
    // Measure the final border ownership and header font, on both first layout
    // and subsequent viewport changes. Otherwise first paint uses different
    // metrics from an already enhanced table (including the extra left border).
    table.classList.add('eyan-layout-table')
    table.classList.toggle('eyan-table-header-row', config.headerRow)
    table.classList.toggle('eyan-table-header-fallback', config.headerRow && !table.querySelector(':scope > thead'))
    table.classList.toggle('eyan-table-title-column', config.titleColumn)
    var widths = tablePixelWidths(table, config)
    var total = widths.reduce(function (sum, width) { return sum + width }, 0)
    var available = tableAvailableWidth(table)
    var fitWidth = Math.max(1, Math.floor(available))
    if (config.layout === 'fit' && Math.abs(total - fitWidth) > 0.1) {
      var scale = fitWidth / Math.max(1, total)
      var scaled = widths.map(function (width) { return width * scale })
      var remaining = fitWidth
      widths = scaled.map(function (width, index) {
        if (index === scaled.length - 1) return remaining
        var rounded = Math.max(1, Math.round(width))
        remaining -= rounded
        return rounded
      })
      total = fitWidth
    }
    if (!config.widths || config.widths.values.length !== columnCount) {
      if (config.layout === 'fit') {
        var ratioTotal = widths.reduce(function (sum, width) { return sum + width }, 0) || 1
        config.widths = { unit: 'ratio', values: widths.map(function (width) { return width / ratioTotal * 100 }) }
      } else {
        config.widths = { unit: 'px', values: widths.slice() }
      }
    }
    table.__eyanTableLayout = cloneTableLayout(config)
    table.__eyanPixelWidths = widths.slice()
    table.classList.add('eyan-layout-table')
    table.classList.toggle('eyan-table-fit', config.layout === 'fit')
    table.classList.toggle('eyan-table-auto', config.layout === 'auto')
    table.classList.toggle('eyan-table-custom', config.layout === 'custom')
    table.classList.toggle('eyan-table-header-row', config.headerRow)
    table.classList.toggle('eyan-table-header-fallback', config.headerRow && !table.querySelector(':scope > thead'))
    table.classList.toggle('eyan-table-title-column', config.titleColumn)
    table.classList.toggle('eyan-table-overflow', config.layout !== 'fit' && total > available + 0.5)
    table.style.setProperty('--eyan-table-inner-width', total + 'px')
    Array.from(table.querySelectorAll('tr')).forEach(function (row, rowIndex) {
      Array.from(row.querySelectorAll(':scope > th, :scope > td')).forEach(function (cell, index) {
        if (widths[index] == null) return
        cell.style.setProperty('--eyan-column-width', widths[index] + 'px')
        var emptyHeader = isVisuallyEmptyTableCell(cell)
        cell.classList.toggle('eyan-empty-table-cell', emptyHeader)
      })
    })
    ensureColumnResizeHandles(table)
    syncFixedColumnResizeHandle(table)
    if (!table.dataset.eyanLayoutScrollBound) {
      table.dataset.eyanLayoutScrollBound = '1'
      table.addEventListener('scroll', function () {
        var index = tableSessionIndex(table)
        var hasSavedPosition = index >= 0 && Object.prototype.hasOwnProperty.call(tableScrollSessions, index)
        if (!hasSavedPosition || table.__eyanScrollIntentOnce || table.__eyanScrollPointerActive) rememberTableScroll(table)
        table.__eyanScrollIntentOnce = false
        if (tableRangeSelection && tableRangeSelection.table === table) paintTableRangeSelection()
        if (stickyTableHeader && stickyTableHeader.classList.contains('eyan-visible')) updateStickyTableHeader()
        else scheduleStickyTableHeader()
        syncFixedColumnResizeHandle(table)
        scheduleTableSelectorLayer()
      }, { passive: true })
    }
    restoreTableScroll(table)
    syncFixedColumnResizeHandle(table)
    captureTableGeometry(table)
    scheduleTableSelectorLayer()
  }

  function collectRenderedTables() {
    var results = []
    getRenderedTableSurfaces().forEach(function (surface) {
      Array.from(surface.root.querySelectorAll('table')).forEach(function (table, index) {
        var columnCount = renderedTableColumnCount(table)
        var saved = tableLayoutSessions[index]
        var config = saved && saved.columnCount === columnCount ? cloneTableLayout(saved) : defaultTableLayout(columnCount)
        var availableWidth = tableAvailableWidth(table)
        var previousAvailableWidth = tableViewportWidthSessions[index]
        if (Number.isFinite(previousAvailableWidth) && Math.abs(previousAvailableWidth - availableWidth) > 2) {
          if (config.layout !== 'fit') config.layout = 'auto'
          config.widths = null
        }
        config.columnCount = columnCount
        table.dataset.eyanTableIndex = String(index)
        table.dataset.eyanTableEditable = surface.editable ? '1' : '0'
        if (!surface.editable) table.querySelectorAll('.eyan-column-resize-handle').forEach(function (handle) { handle.remove() })
        applyTableLayout(table, config)
        tableLayoutSessions[index] = cloneTableLayout(table.__eyanTableLayout)
        tableViewportWidthSessions[index] = tableAvailableWidth(table)
        results.push(table)
      })
    })
    restorePendingTableRange()
    updateStickyTableHeader()
    restorePendingTableTransaction()
    return results
  }

  function applyKnownTableLayoutsBeforePaint() {
    if (tableSynchronousLayoutApplying) return
    tableSynchronousLayoutApplying = true
    try {
      getRenderedTableSurfaces().forEach(function (surface) {
        Array.from(surface.root.querySelectorAll('table')).forEach(function (table, index) {
          var columnCount = renderedTableColumnCount(table)
          var saved = tableLayoutSessions[index]
          if (!saved || saved.columnCount !== columnCount) return
          table.dataset.eyanTableIndex = String(index)
          table.dataset.eyanTableEditable = surface.editable ? '1' : '0'
          applyTableLayout(table, cloneTableLayout(saved))
        })
      })
      updateStickyTableHeader()
      restorePendingTableTransaction()
    } finally {
      tableSynchronousLayoutApplying = false
    }
  }

  function scheduleTableLayoutRefresh() {
    if (tableLayoutFrame) return
    tableLayoutFrame = requestAnimationFrame(function () {
      tableLayoutFrame = null
      collectRenderedTables()
      positionTableLayoutToolbar()
      scheduleStickyTableHeader()
    })
  }

  function setLegacyTablePanelSuppressed(value) {
    var panel = document.querySelector('#fix-table-ir-wrapper .vditor-panel-ir')
    if (panel) panel.classList.toggle('eyan-table-panel-suppressed', !!value)
  }

  function closeTableHeaderMenu() {
    if (!tableHeaderMenu) return
    tableHeaderMenu.classList.remove('eyan-open')
    tableHeaderMenu.setAttribute('aria-hidden', 'true')
    if (tableLayoutToolbar) {
      var trigger = tableLayoutToolbar.querySelector('[data-table-action="headers"]')
      if (trigger) trigger.setAttribute('aria-expanded', 'false')
    }
  }

  function hideTableLayoutToolbar(preserveTable) {
    closeTableHeaderMenu()
    if (!preserveTable && activeLayoutTable) activeLayoutTable.classList.remove('eyan-table-active')
    if (!preserveTable) activeLayoutTable = null
    if (tableLayoutToolbar) {
      tableLayoutToolbar.classList.remove('eyan-visible', 'eyan-position-hidden')
      tableLayoutToolbar.setAttribute('aria-hidden', 'true')
    }
    setLegacyTablePanelSuppressed(false)
  }

  function updateTableToolbarState() {
    if (!tableLayoutToolbar || !activeLayoutTable || !activeLayoutTable.__eyanTableLayout) return
    var config = activeLayoutTable.__eyanTableLayout
    var fit = tableLayoutToolbar.querySelector('[data-table-action="fit"]')
    var header = tableLayoutToolbar.querySelector('[data-table-option="headerRow"]')
    var title = tableLayoutToolbar.querySelector('[data-table-option="titleColumn"]')
    if (fit) {
      fit.classList.toggle('eyan-active', config.layout === 'fit')
      fit.setAttribute('aria-pressed', config.layout === 'fit' ? 'true' : 'false')
    }
    ;[[header, config.headerRow], [title, config.titleColumn]].forEach(function (entry) {
      if (!entry[0]) return
      entry[0].classList.toggle('eyan-selected', entry[1])
      entry[0].setAttribute('aria-checked', entry[1] ? 'true' : 'false')
    })
  }

  function persistActiveTableLayout(config) {
    if (!activeLayoutTable || !activeLayoutTable.isConnected) return
    var index = Number(activeLayoutTable.dataset.eyanTableIndex)
    tableLayoutSessions[index] = cloneTableLayout(config)
    applyTableLayout(activeLayoutTable, config)
    updateTableToolbarState()
    if (stickyTableHeader && stickyTableHeader.classList.contains('eyan-visible')) updateStickyTableHeader()
    else scheduleStickyTableHeader()
  }

  function ensureTableLayoutToolbar() {
    if (tableLayoutToolbar) return tableLayoutToolbar
    var toolbar = document.createElement('div')
    toolbar.id = 'eyan-table-layout-toolbar'
    toolbar.setAttribute('aria-hidden', 'true')
    toolbar.innerHTML =
      '<button type="button" data-table-action="fit" aria-pressed="true"><span class="eyan-table-toolbar-icon">↔</span>Fit page width</button>' +
      '<span class="eyan-table-toolbar-divider"></span>' +
      '<div class="eyan-table-header-control">' +
        '<button type="button" data-table-action="headers" aria-haspopup="menu" aria-expanded="false"><span class="eyan-table-toolbar-icon">▦</span>Table header<span class="eyan-table-toolbar-caret">⌃</span></button>' +
        '<div id="eyan-table-header-menu" role="menu" aria-hidden="true">' +
          '<button type="button" role="menuitemcheckbox" data-table-option="headerRow"><span>Header row</span><span class="eyan-table-check">✓</span><small>Keep the first row visible while scrolling.</small></button>' +
          '<button type="button" role="menuitemcheckbox" data-table-option="titleColumn"><span>Title column</span><span class="eyan-table-check">✓</span><small>Keep the first column visible while scrolling horizontally.</small></button>' +
        '</div>' +
      '</div>' +
      '<span class="eyan-table-toolbar-divider"></span>' +
      '<button type="button" data-table-action="distribute"><span class="eyan-table-toolbar-icon">↔</span>Distribute cols</button>'
    document.body.appendChild(toolbar)
    tableLayoutToolbar = toolbar
    tableHeaderMenu = toolbar.querySelector('#eyan-table-header-menu')
    toolbar.addEventListener('mouseenter', function () {
      clearTimeout(tableToolbarHideTimer)
      setLegacyTablePanelSuppressed(true)
    })
    toolbar.addEventListener('mouseleave', scheduleHideTableLayoutToolbar)
    toolbar.addEventListener('focusin', function () { setLegacyTablePanelSuppressed(true) })
    toolbar.addEventListener('focusout', function (event) {
      if (event.relatedTarget && toolbar.contains(event.relatedTarget)) return
      scheduleHideTableLayoutToolbar()
    })
    toolbar.addEventListener('mousedown', function (event) { event.preventDefault() })
    toolbar.addEventListener('click', function (event) {
      var button = event.target.closest('button')
      if (!button || !activeLayoutTable || !activeLayoutTable.__eyanTableLayout) return
      event.stopPropagation()
      var config = cloneTableLayout(activeLayoutTable.__eyanTableLayout)
      var action = button.dataset.tableAction
      if (action === 'headers') {
        var open = !tableHeaderMenu.classList.contains('eyan-open')
        if (open) {
          tableHeaderMenu.classList.add('eyan-open')
          tableHeaderMenu.setAttribute('aria-hidden', 'false')
          button.setAttribute('aria-expanded', 'true')
          setLegacyTablePanelSuppressed(true)
          updateTableToolbarState()
        } else closeTableHeaderMenu()
        return
      }
      if (button.dataset.tableOption) {
        endTableSelectionForLayoutChange()
        config[button.dataset.tableOption] = !config[button.dataset.tableOption]
        persistActiveTableLayout(config)
        closeTableHeaderMenu()
        return
      }
      if (action === 'fit') {
        endTableSelectionForLayoutChange()
        if (config.layout === 'fit') {
          config.layout = 'auto'
          config.widths = null
        } else {
          config.layout = 'fit'
          config.widths = null
        }
        persistActiveTableLayout(config)
        return
      }
      if (action === 'distribute') {
        endTableSelectionForLayoutChange()
        var current = (activeLayoutTable.__eyanPixelWidths || tablePixelWidths(activeLayoutTable, config)).slice()
        var total = current.reduce(function (sum, width) { return sum + width }, 0)
        config.layout = 'custom'
        config.widths = { unit: 'px', values: Array(config.columnCount).fill(total / Math.max(1, config.columnCount)) }
        persistActiveTableLayout(config)
      }
    })
    return toolbar
  }

  function showTableLayoutToolbar(table) {
    if (state.mode !== 'preview' || !table || table.dataset.eyanTableEditable !== '1') return
    activeLayoutTable = table
  }

  function scheduleHideTableLayoutToolbar() {
    clearTimeout(tableToolbarHideTimer)
    tableToolbarHideTimer = setTimeout(function () {
      if (tableLayoutToolbar && tableLayoutToolbar.matches(':hover')) return
      if (activeLayoutTable && activeLayoutTable.matches(':hover')) return
      closeTableHeaderMenu()
      hideTableLayoutToolbar(true)
      refreshTablePanel()
    }, 140)
  }

  function deactivateTableLayoutEditor() {
    hideTableLayoutToolbar(false)
  }

  function positionTableLayoutToolbar() {
    if (!tableLayoutToolbar || !tableLayoutToolbar.classList.contains('eyan-visible')) return
    if (!activeLayoutTable || !activeLayoutTable.isConnected) {
      deactivateTableLayoutEditor()
      return
    }
    var tableRect = activeLayoutTable.getBoundingClientRect()
    var toolbarRect = tableLayoutToolbar.getBoundingClientRect()
    var edge = 8
    var top = tableRect.top - toolbarRect.height - 8
    if (tableRect.bottom <= 0 || tableRect.top <= edge || top < edge) {
      tableLayoutToolbar.classList.add('eyan-position-hidden')
      closeTableHeaderMenu()
      setLegacyTablePanelSuppressed(false)
      refreshTablePanel()
      return
    }
    tableLayoutToolbar.classList.remove('eyan-position-hidden')
    var left = Math.max(edge, Math.min(tableRect.left, window.innerWidth - toolbarRect.width - edge))
    tableLayoutToolbar.style.left = left + 'px'
    tableLayoutToolbar.style.top = top + 'px'
  }

  function ensureColumnResizeHandles(table) {
    if (table.dataset.eyanTableEditable !== '1') return
    var widths = table.__eyanPixelWidths || []
    if (!widths.length) return
    table.querySelectorAll('th > .eyan-column-resize-handle, td > .eyan-column-resize-handle').forEach(function (handle) { handle.remove() })
    var handles = Array.from(table.querySelectorAll(':scope > .eyan-column-resize-handle'))
    while (handles.length > widths.length) handles.pop().remove()
    var left = 0
    widths.forEach(function (width, index) {
      left += width
      var handle = handles[index]
      if (!handle) {
        handle = document.createElement('span')
        handle.className = 'eyan-column-resize-handle'
        handle.setAttribute('contenteditable', 'false')
        handle.setAttribute('aria-hidden', 'true')
        table.appendChild(handle)
      }
      handle.dataset.columnIndex = String(index)
      handle.dataset.resizeMode = index === widths.length - 1 ? 'last-column' : 'column'
      handle.style.left = (index === widths.length - 1 ? left - 10 : left) + 'px'
      var rect = table.getBoundingClientRect()
      var top = stickyTableHeader && stickyTableHeader.__eyanTable === table
        ? Math.max(0, stickyTableHeader.getBoundingClientRect().top - rect.top) : 0
      handle.style.top = top + 'px'
      handle.style.height = Math.max(0, Math.max(table.scrollHeight, rect.height) - top) + 'px'
      handle.__eyanTable = table
    })
    syncActiveColumnResizeHandles()
  }

  function syncActiveColumnResizeHandles() {
    document.querySelectorAll('.eyan-column-resize-handle').forEach(function (handle) {
      var stateValue = tableResizeSession || activeTableDivider
      var active = !!stateValue && handle.__eyanTable === stateValue.table && Number(handle.dataset.columnIndex) === stateValue.column
      handle.classList.toggle('eyan-column-resize-active', active)
    })
  }

  function removeFixedColumnResizeHandle(table) {
    if (!table) return
    Array.from(document.querySelectorAll('.eyan-column-resize-covered')).forEach(function (handle) {
      if (handle.__eyanTable === table) handle.classList.remove('eyan-column-resize-covered')
    })
    var projected = table.__eyanFixedColumnResizeHandle
    if (projected) projected.remove()
    table.__eyanFixedColumnResizeHandle = null
  }

  function syncFixedColumnResizeHandle(table) {
    if (!table || !table.isConnected || state.mode !== 'preview' || !table.__eyanTableLayout || !table.__eyanTableLayout.titleColumn || table.scrollLeft < 0.5) {
      removeFixedColumnResizeHandle(table)
      return
    }
    var firstCell = table.querySelector('tr > :first-child')
    if (!firstCell) {
      removeFixedColumnResizeHandle(table)
      return
    }
    var tableRect = table.getBoundingClientRect()
    var firstRect = firstCell.getBoundingClientRect()
    var surfaceTop = tableSurfaceViewportTop(table)
    var sticky = stickyTableHeader && stickyTableHeader.__eyanTable === table && stickyTableHeader.classList.contains('eyan-visible')
    var stickyRect = sticky && stickyTableHeader.getBoundingClientRect()
    var top = stickyRect ? stickyRect.top : Math.max(tableRect.top, surfaceTop)
    var bottom = Math.min(window.innerHeight, tableRect.bottom)
    if (bottom <= top + 1 || firstRect.right <= tableRect.left) {
      removeFixedColumnResizeHandle(table)
      return
    }
    Array.from(document.querySelectorAll('.eyan-column-resize-handle:not(.eyan-fixed-column-resize-handle)')).forEach(function (handle) {
      if (handle.__eyanTable !== table) return
      var rect = handle.getBoundingClientRect()
      var center = rect.left + rect.width / 2
      handle.classList.toggle('eyan-column-resize-covered', center > tableRect.left + 0.5 && center < firstRect.right - 0.5)
    })
    var projected = table.__eyanFixedColumnResizeHandle
    if (!projected) {
      projected = document.createElement('span')
      projected.className = 'eyan-column-resize-handle eyan-fixed-column-resize-handle'
      projected.setAttribute('contenteditable', 'false')
      projected.setAttribute('aria-hidden', 'true')
      projected.dataset.columnIndex = '0'
      projected.dataset.resizeMode = 'column'
      document.body.appendChild(projected)
      table.__eyanFixedColumnResizeHandle = projected
    }
    projected.__eyanTable = table
    projected.style.left = firstRect.right - 5 + 'px'
    projected.style.top = top + 'px'
    projected.style.height = Math.max(1, bottom - top) + 'px'
    syncActiveColumnResizeHandles()
  }

  function setActiveTableDivider(table, column, phase) {
    activeTableDivider = table && Number.isFinite(column) ? { table: table, column: column, phase: phase || 'hover' } : null
    syncActiveColumnResizeHandles()
  }

  function beginColumnResize(event, handle) {
    var table = handle.__eyanTable || (handle.closest && handle.closest('table'))
    if (state.mode !== 'preview' || !table || table.dataset.eyanTableEditable !== '1') return
    event.preventDefault()
    event.stopPropagation()
    showTableLayoutToolbar(table)
    var config = cloneTableLayout(table.__eyanTableLayout)
    var pixels = (table.__eyanPixelWidths || tablePixelWidths(table, config)).slice()
    var column = Number(handle.dataset.columnIndex)
    if (!Number.isFinite(column) || column < 0 || column >= pixels.length) return
    tableResizeSession = {
      pointerId: event.pointerId,
      table: table,
      column: column,
      resizeMode: column === pixels.length - 1 ? 'last-column' : 'column',
      startX: event.clientX,
      startPixels: pixels,
      config: config,
      moved: false
    }
    setActiveTableDivider(table, column, 'drag')
    document.body.classList.add('eyan-table-resizing')
    syncActiveColumnResizeHandles()
    if (handle.setPointerCapture) {
      try { handle.setPointerCapture(event.pointerId) } catch (_) {}
    }
  }

  function moveColumnResize(event) {
    if (!tableResizeSession || event.pointerId !== tableResizeSession.pointerId) return
    var session = tableResizeSession
    var delta = event.clientX - session.startX
    var widths = session.startPixels.slice()
    var column = session.column
    widths[column] = Math.max(64, widths[column] + delta)
    session.config.layout = 'custom'
    session.config.widths = { unit: 'px', values: widths }
    session.moved = Math.abs(delta) > 1
    applyTableLayout(session.table, session.config)
    syncActiveColumnResizeHandles()
    positionTableLayoutToolbar()
    if (stickyTableHeader && stickyTableHeader.classList.contains('eyan-visible')) updateStickyTableHeader()
    else scheduleStickyTableHeader()
  }

  function finishColumnResize(event) {
    if (!tableResizeSession) return
    if (event && event.pointerId != null && event.pointerId !== tableResizeSession.pointerId) return
    var session = tableResizeSession
    tableResizeSession = null
    activeTableDivider = null
    document.body.classList.remove('eyan-table-resizing')
    syncActiveColumnResizeHandles()
    if (session.moved && session.table.isConnected) {
      activeLayoutTable = session.table
      persistActiveTableLayout(session.config)
    }
  }

  // The fixed header IS the original thead: one editing host and save path.
  function scheduleStickyTableHeader() {
    if (stickyTableFrame) return
    stickyTableFrame = requestAnimationFrame(function () {
      stickyTableFrame = null
      updateStickyTableHeader()
    })
  }

  function releaseStickyTableHeader(header) {
    if (!header) return
    header.classList.remove('eyan-sticky-source-header', 'eyan-visible')
    header.style.removeProperty('transform')
    header.__eyanStickyOffset = 0
    if (header.__eyanTable) header.__eyanTable.classList.remove('eyan-has-fixed-header')
  }

  function updateStickyTableHeader() {
    var previous = stickyTableHeader
    var candidate = null
    getRenderedTableSurfaces().forEach(function (surface) {
      var viewportTop = Math.max(0, surface.root.getBoundingClientRect().top)
      Array.from(surface.root.querySelectorAll('table.eyan-layout-table')).forEach(function (table) {
        var header = table.querySelector('thead')
        if (!header) return
        var rect = header.getBoundingClientRect()
        var tableRect = table.getBoundingClientRect()
        // The editor may rebuild thead with its inline transform but without
        // JS expando state. Never derive layout origin from transformed DOM.
        var naturalTop = tableRect.top
        var offset = table.__eyanTableLayout && table.__eyanTableLayout.headerRow
          ? Math.max(0, Math.min(viewportTop + TABLE_TOP_RAIL_HEIGHT - naturalTop, tableRect.bottom - rect.height - naturalTop)) : 0
        if (offset > 0 && tableRect.bottom > viewportTop + TABLE_TOP_RAIL_HEIGHT && !candidate) {
          header.__eyanTable = table
          header.__eyanStickyOffset = offset
          header.classList.add('eyan-sticky-source-header', 'eyan-visible')
          header.style.transform = 'translateY(' + offset + 'px)'
          table.classList.add('eyan-has-fixed-header')
          candidate = header
        } else releaseStickyTableHeader(header)
      })
    })
    if (previous && previous !== candidate) releaseStickyTableHeader(previous)
    stickyTableHeader = candidate
    getRenderedTableSurfaces().forEach(function (surface) {
      surface.root.querySelectorAll('table.eyan-layout-table').forEach(function (table) {
        if (table.dataset.eyanTableEditable === '1') ensureColumnResizeHandles(table)
        syncFixedColumnResizeHandle(table)
      })
    })
    if (tableRangeSelection) paintTableRangeSelection()
    scheduleTableSelectorLayer()
  }

  function tableSelectorDots() {
    return '<span></span><span></span><span></span><span></span><span></span><span></span>'
  }

  function ensureTableSelectorLayer() {
    if (tableSelectorLayer) return tableSelectorLayer
    var layer = document.createElement('div')
    layer.id = 'eyan-table-selector-layer'
    document.body.appendChild(layer)
    tableSelectorLayer = layer
    return layer
  }

  function hideTableSelectorHandles() {
    if (!tableSelectorLayer || tableSelectorPointer) return
    tableSelectorLayer.querySelectorAll('.eyan-table-selector-handle').forEach(function (handle) { handle.classList.remove('eyan-visible') })
  }

  function clearTableSelectorLayer() {
    tableSelectorHover = null
    cancelTableSelectorAutoScroll()
    if (tableSelectorFrame) cancelAnimationFrame(tableSelectorFrame)
    tableSelectorFrame = null
    if (tableSelectorLayer) tableSelectorLayer.innerHTML = ''
  }

  function appendTableSelectorHit(layer, table, kind, index, left, top, width, height) {
    if (width <= 0.5 || height <= 0.5) return
    var handle = document.createElement('button')
    handle.type = 'button'
    handle.className = 'eyan-table-selector-handle eyan-table-' + kind + '-selector'
    handle.setAttribute('aria-label', kind === 'column' ? 'Select column' : 'Select row')
    handle.dataset[kind + 'Index'] = String(index)
    handle.style.left = Math.round(left * 100) / 100 + 'px'
    handle.style.top = Math.round(top * 100) / 100 + 'px'
    handle.style.width = Math.round(width * 100) / 100 + 'px'
    handle.style.height = Math.round(height * 100) / 100 + 'px'
    handle.innerHTML = tableSelectorDots()
    handle.__eyanTable = table
    layer.appendChild(handle)
  }

  function rebuildTableSelectorLayer() {
    tableSelectorFrame = null
    if (state.mode !== 'preview' || tableSelectorPointer || tableResizeSession) return
    var layer = ensureTableSelectorLayer()
    layer.innerHTML = ''
    getRenderedTableSurfaces().forEach(function (surface) {
      Array.from(surface.root.querySelectorAll('table.eyan-layout-table[data-eyan-table-editable="1"]')).forEach(function (table) {
        var geometry = captureTableGeometry(table)
        if (!geometry || geometry.visibleRect.right <= geometry.visibleRect.left || geometry.visibleRect.bottom <= geometry.visibleRect.top) return
        var sticky = stickyTableHeader && stickyTableHeader.__eyanTable === table && stickyTableHeader.classList.contains('eyan-visible')
        var stickyRect = sticky ? stickyTableHeader.getBoundingClientRect() : null
        var railTop = (stickyRect ? stickyRect.top : geometry.tableRect.top) - TABLE_TOP_RAIL_HEIGHT
        geometry.columnBounds.forEach(function (column) {
          var left = Math.max(geometry.visibleRect.left, column.left)
          var right = Math.min(geometry.visibleRect.right, column.right)
          appendTableSelectorHit(layer, table, 'column', column.column, left, railTop, right - left, TABLE_TOP_RAIL_HEIGHT)
        })
        var bodyClipTop = stickyRect ? stickyRect.bottom : geometry.visibleRect.top
        geometry.rowBounds.forEach(function (row) {
          var rowTop = row.top
          var rowBottom = row.bottom
          if (!(stickyRect && row.row === 0)) rowTop = Math.max(bodyClipTop, rowTop)
          rowBottom = Math.min(geometry.visibleRect.bottom, rowBottom)
          appendTableSelectorHit(layer, table, 'row', row.row, Math.max(0, geometry.visibleRect.left - TABLE_LEFT_RAIL_WIDTH), rowTop, TABLE_LEFT_RAIL_WIDTH, rowBottom - rowTop)
        })
      })
    })
    if (tableSelectorHover && tableSelectorHover.table && tableSelectorHover.table.isConnected) {
      var hovered = Array.from(layer.querySelectorAll('.eyan-table-' + tableSelectorHover.kind + '-selector')).find(function (handle) {
        return handle.__eyanTable === tableSelectorHover.table && Number(handle.dataset[tableSelectorHover.kind + 'Index']) === tableSelectorHover.index
      })
      if (hovered) hovered.classList.add('eyan-visible')
    }
  }

  function scheduleTableSelectorLayer() {
    if (tableSelectorFrame || state.mode !== 'preview') return
    tableSelectorFrame = requestAnimationFrame(rebuildTableSelectorLayer)
  }

  function positionTableSelectorHandles(event) {
    if (state.mode !== 'preview' || tableSelectorPointer || tableResizeSession) return
    var hit = event.target && event.target.closest && event.target.closest('.eyan-table-selector-handle')
    if (hit) {
      var hitKind = hit.classList.contains('eyan-table-column-selector') ? 'column' : 'row'
      tableSelectorHover = { table: hit.__eyanTable, kind: hitKind, index: Number(hit.dataset[hitKind + 'Index']) }
      hideTableSelectorHandles()
      hit.classList.add('eyan-visible')
      return
    }
    var cell = event.target && event.target.closest && event.target.closest('.vditor-ir table.eyan-layout-table[data-eyan-table-editable="1"] th, .vditor-ir table.eyan-layout-table[data-eyan-table-editable="1"] td')
    var position = tableCellPosition(cell)
    if (!position) {
      tableSelectorHover = null
      hideTableSelectorHandles()
      return
    }
    var layer = ensureTableSelectorLayer()
    hideTableSelectorHandles()
    if (position.row === 0) {
      var columnHandle = Array.from(layer.querySelectorAll('.eyan-table-column-selector')).find(function (handle) {
        return handle.__eyanTable === position.table && Number(handle.dataset.columnIndex) === position.column
      })
      if (columnHandle) {
        tableSelectorHover = { table: position.table, kind: 'column', index: position.column }
        columnHandle.classList.add('eyan-visible')
      }
    }
    if (position.column === 0 && position.row > 0) {
      var rowHandle = Array.from(layer.querySelectorAll('.eyan-table-row-selector')).find(function (handle) {
        return handle.__eyanTable === position.table && Number(handle.dataset.rowIndex) === position.row
      })
      if (rowHandle) {
        tableSelectorHover = { table: position.table, kind: 'row', index: position.row }
        rowHandle.classList.add('eyan-visible')
      }
    }
  }

  function beginTableSelector(event, handle) {
    var table = handle && handle.__eyanTable
    if (!table || state.mode !== 'preview') return
    var kind = handle.classList.contains('eyan-table-column-selector') ? 'column' : 'row'
    var index = Number(handle.dataset[kind + 'Index'])
    if (!Number.isFinite(index)) return
    event.preventDefault()
    event.stopPropagation()
    clearTableRangeSelection()
    var rows = table.querySelectorAll('tr').length
    var columns = renderedTableColumnCount(table)
    tableRangeSelection = kind === 'column'
      ? { table: table, startRow: 0, endRow: rows - 1, startColumn: index, endColumn: index, selectionKind: 'column' }
      : { table: table, startRow: index, endRow: index, startColumn: 0, endColumn: columns - 1, selectionKind: 'row' }
    tableSelectorPointer = { pointerId: event.pointerId, table: table, kind: kind, startIndex: index, currentIndex: index, clientX: event.clientX, clientY: event.clientY }
    var selection = window.getSelection()
    if (selection) selection.removeAllRanges()
    paintTableRangeSelection()
    if (handle.setPointerCapture) {
      try { handle.setPointerCapture(event.pointerId) } catch (_) {}
    }
  }

  function tableColumnNearX(table, x) {
    var geometry = captureTableGeometry(table)
    var cells = geometry ? geometry.columnBounds : []
    var result = 0
    Array.from(cells).some(function (column, index) {
      result = index
      return x <= column.right
    })
    return result
  }

  function tableRowNearY(table, y) {
    var rows = table.querySelectorAll('tr')
    var result = 0
    Array.from(rows).some(function (row, index) {
      var rect = row.getBoundingClientRect()
      result = index
      return y <= rect.bottom
    })
    return result
  }

  function updateTableSelectorSelection(pointer) {
    if (!pointer || !pointer.table || !pointer.table.isConnected) return
    var table = pointer.table
    var index = pointer.kind === 'column' ? tableColumnNearX(table, pointer.clientX) : tableRowNearY(table, pointer.clientY)
    pointer.currentIndex = index
    var rows = table.querySelectorAll('tr').length
    var columns = renderedTableColumnCount(table)
    if (pointer.kind === 'column') {
      tableRangeSelection = { table: table, startRow: 0, endRow: rows - 1, startColumn: Math.min(pointer.startIndex, index), endColumn: Math.max(pointer.startIndex, index), selectionKind: 'column' }
    } else {
      tableRangeSelection = { table: table, startRow: Math.min(pointer.startIndex, index), endRow: Math.max(pointer.startIndex, index), startColumn: 0, endColumn: columns - 1, selectionKind: 'row' }
    }
    paintTableRangeSelection()
  }

  function cancelTableSelectorAutoScroll() {
    if (tableSelectorAutoScrollFrame) cancelAnimationFrame(tableSelectorAutoScrollFrame)
    tableSelectorAutoScrollFrame = null
  }

  function scheduleTableSelectorAutoScroll() {
    if (tableSelectorAutoScrollFrame || !tableSelectorPointer) return
    tableSelectorAutoScrollFrame = requestAnimationFrame(runTableSelectorAutoScroll)
  }

  function runTableSelectorAutoScroll() {
    tableSelectorAutoScrollFrame = null
    var pointer = tableSelectorPointer
    if (!pointer || !pointer.table || !pointer.table.isConnected) return
    var moved = false
    var edge = 32
    var table = pointer.table
    var tableRect = table.getBoundingClientRect()
    if (pointer.kind === 'column' && table.scrollWidth > table.clientWidth + 1) {
      var horizontalDirection = pointer.clientX < tableRect.left + edge ? -1 : pointer.clientX > tableRect.right - edge ? 1 : 0
      if (horizontalDirection) {
        var beforeLeft = table.scrollLeft
        table.scrollLeft = Math.max(0, Math.min(table.scrollWidth - table.clientWidth, beforeLeft + horizontalDirection * 14))
        if (Math.abs(table.scrollLeft - beforeLeft) >= 0.5) {
          rememberTableScroll(table)
          moved = true
        }
      }
    }
    if (pointer.kind === 'row') {
      var scroller = tableScrollContainer(table)
      if (scroller) {
        var documentScroller = scroller === document.documentElement || scroller === document.body || scroller === document.scrollingElement
        var scrollerRect = documentScroller ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect()
        var verticalDirection = pointer.clientY < scrollerRect.top + edge ? -1 : pointer.clientY > scrollerRect.bottom - edge ? 1 : 0
        if (verticalDirection) {
          var beforeTop = Number(scroller.scrollTop) || 0
          var rows = table.querySelectorAll('tr')
          var averageRowHeight = rows.length ? Math.max(12, table.scrollHeight / rows.length) : 32
          scroller.scrollTop = Math.max(0, beforeTop + verticalDirection * Math.min(averageRowHeight / 2, 16))
          if (Math.abs((Number(scroller.scrollTop) || 0) - beforeTop) >= 0.5) moved = true
        }
      }
    }
    if (!moved) return
    updateTableSelectorSelection(pointer)
    scheduleStickyTableHeader()
    scheduleTableSelectorAutoScroll()
  }

  function moveTableSelector(event) {
    var pointer = tableSelectorPointer
    if (!pointer || event.pointerId !== pointer.pointerId || !pointer.table.isConnected) return
    event.preventDefault()
    event.stopPropagation()
    pointer.clientX = event.clientX
    pointer.clientY = event.clientY
    updateTableSelectorSelection(pointer)
    cancelTableSelectorAutoScroll()
    scheduleTableSelectorAutoScroll()
    scheduleStickyTableHeader()
  }

  function finishTableSelector(event) {
    if (!tableSelectorPointer) return
    if (event && event.pointerId != null && event.pointerId !== tableSelectorPointer.pointerId) return
    cancelTableSelectorAutoScroll()
    tableSelectorPointer = null
    scheduleTableSelectorLayer()
  }

  function bindTableDocumentListeners() {
    if (tableDocumentListenersBound) return
    tableDocumentListenersBound = true
    window.addEventListener('keydown', guardTableDeletion, true)
    document.addEventListener('wheel', function () {
      clearPendingTableTransaction()
      tableInputViewportLock = null
    }, { capture: true, passive: true })
    document.addEventListener('pointerdown', function (event) {
      if (event.button === 0) clearPendingTableTransaction()
      var selector = event.target.closest && event.target.closest('.eyan-table-selector-handle')
      var tableMenuTarget = event.target.closest && event.target.closest('#eyan-table-context-menu')
      var tableInteractionTarget = event.target.closest && event.target.closest('.vditor-ir table.eyan-layout-table, .eyan-table-selector-handle')
      if (tableRangeSelection && !tableMenuTarget) {
        if (event.button === 0 && !selector) clearTableRangeSelection()
        else if (event.button === 2 && !tableInteractionTarget) clearTableRangeSelection()
      }
      if (selector && event.button === 0) {
        beginTableSelector(event, selector)
        return
      }
      var handle = event.target.closest && event.target.closest('.eyan-column-resize-handle')
      if (handle) beginColumnResize(event, handle)
    }, true)
    document.addEventListener('pointerover', function (event) {
      if (tableResizeSession) return
      var handle = event.target.closest && event.target.closest('.eyan-column-resize-handle')
      if (!handle) return
      var table = handle.__eyanTable || (handle.closest && handle.closest('table.eyan-layout-table'))
      setActiveTableDivider(table, Number(handle.dataset.columnIndex), 'hover')
    }, true)
    document.addEventListener('pointerout', function (event) {
      if (tableResizeSession || !activeTableDivider) return
      var handle = event.target.closest && event.target.closest('.eyan-column-resize-handle')
      if (!handle) return
      var next = event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest('.eyan-column-resize-handle')
      if (next && next.__eyanTable === activeTableDivider.table && Number(next.dataset.columnIndex) === activeTableDivider.column) return
      setActiveTableDivider(null)
    }, true)
    document.addEventListener('pointermove', positionTableSelectorHandles, true)
    document.addEventListener('pointermove', moveTableSelector, true)
    document.addEventListener('pointerup', finishTableSelector, true)
    document.addEventListener('pointercancel', finishTableSelector, true)
    window.addEventListener('blur', finishTableSelector)
    document.addEventListener('wheel', markTableScrollIntent, { passive: true, capture: true })
    document.addEventListener('pointerdown', markTableScrollIntent, true)
    document.addEventListener('pointerup', finishTableScrollIntent, true)
    document.addEventListener('pointercancel', finishTableScrollIntent, true)
    window.addEventListener('blur', finishTableScrollIntent)
    document.addEventListener('pointermove', moveColumnResize, true)
    document.addEventListener('pointerup', finishColumnResize, true)
    document.addEventListener('pointercancel', finishColumnResize, true)
    window.addEventListener('blur', finishColumnResize)
    document.addEventListener('pointerdown', beginTableRangePointer, true)
    document.addEventListener('pointermove', moveTableRangePointer, true)
    document.addEventListener('pointerup', finishTableRangePointer, true)
    document.addEventListener('pointercancel', finishTableRangePointer, true)
    window.addEventListener('blur', finishTableRangePointer)
    document.addEventListener('copy', copyTableRange, true)
    document.addEventListener('paste', pasteTableRange, true)
    // Vditor may consume Escape on the document during capture. Handle it one
    // level earlier so a persistent multi-cell selection always has an exit.
    window.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !tableRangeSelection) return
      clearPendingTableTransaction()
      clearTableRangeSelection()
      event.preventDefault()
    }, true)
    document.addEventListener('contextmenu', function (event) {
      if (state.mode !== 'preview') return
      var selector = event.target.closest && event.target.closest('.eyan-table-selector-handle')
      if (selector && selector.__eyanTable) {
        var selectorKind = selector.classList.contains('eyan-table-column-selector') ? 'column' : 'row'
        var selectorIndex = Number(selector.dataset[selectorKind + 'Index'])
        var selectorRow = selectorKind === 'row' ? selectorIndex : 0
        var selectorColumn = selectorKind === 'column' ? selectorIndex : 0
        var selectorCell = tableCellAt(selector.__eyanTable, selectorRow, selectorColumn)
        if (selectorCell) {
          event.preventDefault()
          event.stopPropagation()
          activeLayoutTable = selector.__eyanTable
          lastTableCell = selectorCell
          lastTableCellPosition = { table: renderedTableIndex(selector.__eyanTable), row: selectorRow, column: selectorColumn }
          showTableContextMenu(event.clientX, event.clientY, selectorCell, null)
          return
        }
      }
    }, true)
    document.addEventListener('keydown', function (event) {
      var editingCell = activeTableEditingCell()
      if (editingCell && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter')) captureTableInputViewport(editingCell)
      if (event.key === 'Escape' && tableRangeSelection) {
        clearTableRangeSelection()
        event.preventDefault()
        return
      }
      if (tableRangeSelection && (event.key === 'Delete' || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (clearSelectedTableRange()) {
          event.preventDefault()
          event.stopPropagation()
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
        }
      }
    }, true)
    document.addEventListener('click', function (event) {
      if (suppressTableRangeClick && event.target.closest && event.target.closest('table.eyan-layout-table')) {
        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
        suppressTableRangeClick = false
        return
      }
      if (tableHeaderMenu && tableHeaderMenu.classList.contains('eyan-open') && !event.target.closest('#eyan-table-header-menu') && !event.target.closest('[data-table-action="headers"]')) {
        closeTableHeaderMenu()
      }
      if (state.mode !== 'preview') return
      var table = event.target.closest && event.target.closest('.vditor-ir table')
      if (table) showTableLayoutToolbar(table)
      else if (!event.target.closest('#eyan-table-layout-toolbar')) deactivateTableLayoutEditor()
    }, true)
    document.addEventListener('mouseover', function (event) {
      if (state.mode !== 'preview') return
      var table = event.target.closest && event.target.closest('.vditor-ir table.eyan-table-active')
      if (table) showTableLayoutToolbar(table)
    }, true)
    document.addEventListener('mouseout', function (event) {
      var table = event.target.closest && event.target.closest('.vditor-ir table.eyan-table-active')
      if (!table) return
      var next = event.relatedTarget
      if (next && (table.contains(next) || (tableLayoutToolbar && tableLayoutToolbar.contains(next)))) return
      scheduleHideTableLayoutToolbar()
    }, true)
    document.addEventListener('scroll', function () {
      tablePanelRequested = false
      refreshTablePanel()
      hideTableLayoutToolbar(false)
      if (tableRangeSelection) paintTableRangeSelection()
      scheduleStickyTableHeader()
      scheduleTableSelectorLayer()
    }, true)
    window.addEventListener('resize', function () {
      scheduleTableLayoutRefresh()
      if (tableRangeSelection) paintTableRangeSelection()
      scheduleTableSelectorLayer()
    })
  }

  function enhanceTableLayouts() {
    bindTableDocumentListeners()
    collectRenderedTables()
    if (!tableLayoutResizeObserver && typeof ResizeObserver !== 'undefined') {
      tableLayoutResizeObserver = new ResizeObserver(scheduleTableLayoutRefresh)
    }
    if (tableLayoutResizeObserver) {
      getRenderedTableSurfaces().forEach(function (surface) {
        if (!surface.root.dataset.eyanTableResizeObserved) {
          surface.root.dataset.eyanTableResizeObserved = '1'
          tableLayoutResizeObserver.observe(surface.root)
        }
      })
    }
    if (state.mode !== 'preview') deactivateTableLayoutEditor()
    scheduleStickyTableHeader()
    scheduleTableSelectorLayer()
  }

  function activeTableEditingCell() {
    var selection = window.getSelection()
    var node = selection && selection.anchorNode
    var element = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)
    var cell = element && element.closest && element.closest('th, td')
    return cell && cell.closest('.vditor-ir table.eyan-layout-table') ? cell : null
  }

  function guardTableDeletion(event) {
    if (tableRangeSelection || tableCompositionCell || event.isComposing || event.keyCode === 229) return
    var backward = event.key === 'Backspace' || /^delete.*Backward$/.test(event.inputType || '')
    var forward = event.key === 'Delete' || /^delete.*Forward$/.test(event.inputType || '')
    if (!backward && !forward) return
    var cell = activeTableEditingCell()
    var selection = window.getSelection()
    if (!cell || !selection.rangeCount) return
    var range = selection.getRangeAt(0)
    var crossesCell = !cell.contains(range.startContainer) || !cell.contains(range.endContainer)
    if (!crossesCell && !range.collapsed) return
    var remaining = document.createRange()
    remaining.selectNodeContents(cell)
    if (!crossesCell) {
      if (backward) remaining.setEnd(range.startContainer, range.startOffset)
      else remaining.setStart(range.endContainer, range.endOffset)
    }
    var fragment = document.createElement('div')
    fragment.appendChild(remaining.cloneContents())
    fragment.querySelectorAll('.vditor-ir__marker, .eyan-table-line-break').forEach(function (node) { node.remove() })
    if (crossesCell || !fragment.textContent.replace(/[\u200B\uFEFF]/g, '')) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  function enhanceTableEditor() {
    var reset = document.querySelector('.vditor-ir .vditor-reset')
    if (reset && !reset.dataset.eyanTableSurfaceBound) {
      reset.dataset.eyanTableSurfaceBound = '1'
      reset.addEventListener('compositionstart', function () {
        tableCompositionCell = activeTableEditingCell()
        if (!tableCompositionCell) return
        var row = tableCompositionCell.parentElement
        tableCompositionCell.__eyanCompositionRow = {
          table: renderedTableIndex(tableCompositionCell.closest('table')),
          row: Array.from(tableCompositionCell.closest('table').querySelectorAll('tr')).indexOf(row),
          height: row.style.height
        }
        row.style.height = row.getBoundingClientRect().height + 'px'
        captureTableInputViewport(tableCompositionCell)
      }, true)
      reset.addEventListener('compositionend', function () {
        var cell = tableCompositionCell
        var savedRow = cell && cell.__eyanCompositionRow
        tableCompositionCell = null
        requestAnimationFrame(function () {
          if (tableCompositionCell) return
          var table = savedRow && reset.querySelectorAll('table')[savedRow.table]
          var row = table && table.querySelectorAll('tr')[savedRow.row]
          if (row) row.style.height = savedRow.height
          scheduleTableInputViewportRestore()
        })
      }, true)
      reset.addEventListener('mousedown', function (event) {
        var cell = event.target.closest('td, th')
        // A new user gesture supersedes a paste/structure restoration, even
        // when Vditor replaces that transaction's old cell on the next input.
        if (event.button === 0) {
          pendingTableTransaction = null
          pendingTableRangeRestore = null
        }
        if (!cell) {
          tablePanelRequested = false
          refreshTablePanel()
          return
        }
        lastTableCell = cell
        var table = cell.closest('table')
        lastTableCellPosition = {
          table: Array.from(reset.querySelectorAll('table')).indexOf(table),
          row: Array.from(table.querySelectorAll('tr')).indexOf(cell.parentElement),
          column: Array.from(cell.parentElement.children).indexOf(cell)
        }
        if (isVisuallyEmptyTableCell(cell)) {
          cell.classList.add('eyan-empty-table-cell')
          event.preventDefault()
          normalizeEmptyTableCaret(cell)
        }
        var selection = window.getSelection()
        if (selection && selection.rangeCount) {
          try { savedTableRange = selection.getRangeAt(0).cloneRange() } catch (_) {}
        }
      }, true)
      reset.addEventListener('click', function (event) {
        var cell = event.target.closest('td, th')
        if (!cell) return
        tablePanelRequested = false
        lastTableCell = cell
        var clickedTable = cell.closest('table')
        var tableIndex = Array.from(reset.querySelectorAll('table')).indexOf(clickedTable)
        var rowIndex = Array.from(clickedTable.querySelectorAll('tr')).indexOf(cell.parentElement)
        var columnIndex = Array.from(cell.parentElement.children).indexOf(cell)
        lastTableCellPosition = { table: tableIndex, row: rowIndex, column: columnIndex }
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            var liveTable = reset.querySelectorAll('table')[tableIndex]
            var liveRow = liveTable && liveTable.querySelectorAll('tr')[rowIndex]
            var liveCell = liveRow && liveRow.querySelectorAll(':scope > th, :scope > td')[columnIndex]
            if (liveCell) {
              lastTableCell = liveCell
              normalizeEmptyTableCaret(liveCell)
            }
            var selection = window.getSelection()
            if (selection && selection.rangeCount && selection.anchorNode && lastTableCell.contains(selection.anchorNode)) {
              try { savedTableRange = selection.getRangeAt(0).cloneRange() } catch (_) {}
            }
            enhanceTableEditor()
            refreshTablePanel()
          })
        })
      }, true)
      reset.addEventListener('beforeinput', function (event) {
        guardTableDeletion(event)
        var cell = activeTableEditingCell()
        if (!cell || event.defaultPrevented) return
        pendingTableTransaction = null
        pendingTableRangeRestore = null
        if (!tableInputViewportLock || Date.now() > tableInputViewportLock.expires) captureTableInputViewport(cell)
        tablePanelRequested = false
        refreshTablePanel()
      }, true)
      reset.addEventListener('input', function (event) {
        if (!activeTableEditingCell()) return
        scheduleTableInputViewportRestore()
        requestAnimationFrame(function () {
          var selection = window.getSelection()
          var anchor = selection && selection.anchorNode
          var activeCell = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)
          activeCell = activeCell && activeCell.closest && activeCell.closest('th, td')
          if (!activeCell || !reset.contains(activeCell)) return
          var empty = isVisuallyEmptyTableCell(activeCell)
          activeCell.classList.toggle('eyan-empty-table-cell', empty)
          if (empty && !tableCompositionCell && !event.isComposing) normalizeEmptyTableCaret(activeCell)
        })
      }, true)
    }
    var panel = document.querySelector('#fix-table-ir-wrapper .vditor-panel-ir')
    if (!panel || panel.dataset.eyanTableBound) return
    panel.dataset.eyanTableBound = '1'
    panel.addEventListener('mouseenter', function () { hideTableLayoutToolbar(true) })
    panel.addEventListener('focusin', function () { hideTableLayoutToolbar(true) })
    panel.addEventListener('mousedown', function (event) {
      hideTableLayoutToolbar(true)
      // Table commands depend on the current cell selection.
      event.preventDefault()
      if (savedTableRange) {
        var selection = window.getSelection()
        if (selection) {
          try {
            selection.removeAllRanges()
            selection.addRange(savedTableRange)
          } catch (_) {}
        }
      }
      var command = event.target.closest('[data-type]')
      if (command) prepareTableStructureChange(command.dataset.type)
    })
    var labels = {
      insertRowB: '+ Row',
      deleteRow: '- Row',
      insertColumnR: '+ Column',
      deleteColumn: '- Column'
    }
    Array.from(panel.children).forEach(function (control) {
      var type = control.dataset && control.dataset.type
      var allowed = Object.prototype.hasOwnProperty.call(labels, type)
      control.classList.toggle('eyan-table-panel-hidden-control', !allowed)
      control.setAttribute('aria-hidden', allowed ? 'false' : 'true')
      if ('tabIndex' in control) control.tabIndex = allowed ? 0 : -1
    })
    Object.keys(labels).forEach(function (type) {
      var button = panel.querySelector('[data-type="' + type + '"]')
      if (!button) return
      button.setAttribute('aria-label', labels[type])
      button.textContent = labels[type]
      panel.appendChild(button)
    })
    new MutationObserver(function () {
      requestAnimationFrame(refreshTablePanel)
    }).observe(panel, { attributes: true, attributeFilter: ['class', 'style'] })
  }

  function followTablePanelOpening(attempt) {
    refreshTablePanel()
    var panel = document.querySelector('#fix-table-ir-wrapper .vditor-panel-ir')
    if (panel && panel.style.display !== 'none' && panel.classList.contains('eyan-table-panel-visible')) return
    if (attempt < 24) setTimeout(function () { followTablePanelOpening(attempt + 1) }, 100)
  }

  function refreshTablePanel() {
    var panel = document.querySelector('#fix-table-ir-wrapper .vditor-panel-ir')
    if (!panel) return
    if (!tablePanelRequested) {
      panel.classList.remove('eyan-table-panel-visible')
      return
    }
    if (panel.classList.contains('eyan-table-panel-suppressed')) {
      panel.classList.remove('eyan-table-panel-visible')
      return
    }
    if ((!lastTableCell || !lastTableCell.isConnected) && lastTableCellPosition) {
      var reset = document.querySelector('.vditor-ir .vditor-reset')
      var table = reset && reset.querySelectorAll('table')[lastTableCellPosition.table]
      var row = table && table.querySelectorAll('tr')[lastTableCellPosition.row]
      var liveCell = row && row.querySelectorAll(':scope > th, :scope > td')[lastTableCellPosition.column]
      if (liveCell) lastTableCell = liveCell
    }
    if ((!lastTableCell || !lastTableCell.isConnected) && activeLayoutTable && activeLayoutTable.isConnected) {
      lastTableCell = activeLayoutTable.querySelector('td, th')
    }
    var hidden = panel.style.display === 'none'
    if (hidden || !lastTableCell || !lastTableCell.isConnected) {
      panel.classList.remove('eyan-table-panel-visible')
      return
    }
    panel.classList.add('eyan-table-panel-visible')
    if (handle) handle.style.display = 'none'
    var cellRect = lastTableCell.getBoundingClientRect()
    var panelRect = panel.getBoundingClientRect()
    var gap = 6
    var edge = 8
    var below = window.innerHeight - cellRect.bottom - edge
    var above = cellRect.top - edge
    var top = cellRect.bottom + gap
    if (below < panelRect.height + gap && above > below) top = cellRect.top - panelRect.height - gap
    top = Math.max(edge, Math.min(top, window.innerHeight - panelRect.height - edge))
    var left = Math.max(edge, Math.min(cellRect.left, window.innerWidth - panelRect.width - edge))
    if (panel.style.left !== left + 'px') panel.style.left = left + 'px'
    if (panel.style.top !== top + 'px') panel.style.top = top + 'px'
  }

  function getSplitAnchorTops(surface, source) {
    var tops = getSplitHeadingAnchors(surface, source).map(function (anchor) { return getAnchorTop(surface, anchor) })
    // 虚拟文档顶部锚点：第一个标题之前的内容（如 frontmatter 区）也能按比例联动
    tops.unshift(0)
    return tops
  }

  function getScrollAnchorState(surface, tops) {
    if (!tops.length) return null
    var position = surface.scrollTop + 24
    var index = 0
    for (var i = 0; i < tops.length; i++) {
      if (tops[i] <= position) index = i
      else break
    }
    var current = tops[index]
    var next = index + 1 < tops.length ? tops[index + 1] : Math.max(current + 1, surface.scrollHeight)
    return { index: index, progress: Math.max(0, Math.min(1, (position - current) / Math.max(1, next - current))) }
  }

  function mapScrollByHeadings(from, to) {
    var fromTops = getSplitAnchorTops(from, from.classList.contains('vditor-sv'))
    var toTops = getSplitAnchorTops(to, to.classList.contains('vditor-sv'))
    var stateAtScroll = getScrollAnchorState(from, fromTops)
    if (!stateAtScroll || toTops.length < 2) {
      var fromRange = from.scrollHeight - from.clientHeight
      var toRange = to.scrollHeight - to.clientHeight
      return fromRange > 0 && toRange > 0 ? (from.scrollTop / fromRange) * toRange : 0
    }
    var index = Math.min(stateAtScroll.index, toTops.length - 1)
    var current = toTops[index]
    var next = index + 1 < toTops.length ? toTops[index + 1] : Math.max(current + 1, to.scrollHeight)
    return current + stateAtScroll.progress * Math.max(1, next - current) - 24
  }

  function queueSplitScroll(from, to) {
    if (state.mode !== 'split' || !from || !to) return
    var expected = splitExpectedScroll.get(from)
    if (typeof expected === 'number') {
      splitExpectedScroll.delete(from)
      if (Math.abs(from.scrollTop - expected) < 1) return
    }
    splitScrollPending = { from: from, to: to }
    if (splitScrollFrame) return
    splitScrollFrame = requestAnimationFrame(function () {
      splitScrollFrame = null
      var pending = splitScrollPending
      splitScrollPending = null
      if (!pending || state.mode !== 'split') return
      setProgrammaticScroll(pending.to, mapScrollByHeadings(pending.from, pending.to))
      // Source decorations observe the completed mapping; they never participate
      // in the user-scroll frame that chooses the synchronization target.
      requestAnimationFrame(scheduleSplitOverlayScroll)
    })
  }

  function handleSplitScrollEvent(event) {
    if (state.mode !== 'split') return
    var source = document.querySelector('.vditor-sv')
    var preview = document.querySelector('.vditor-preview')
    if (event.target !== source && event.target !== preview) return
    // Vditor also installs percentage-based Split scroll handlers on the panes.
    // Stop those target listeners and let the heading-anchor mapping own the sync.
    event.stopPropagation()
    if (splitInputLockIsActive()) {
      // A source scroll well after the last keystroke is the user navigating,
      // not vditor's caret-follow render side effect: hand control back.
      if (event.target === source && Date.now() - lastSplitInputAt > 250) splitInputScrollLock = null
      else return
    }
    if (event.target === source) queueSplitScroll(source, preview)
    else queueSplitScroll(preview, source)
  }

  function bindSplitScrollSync() {
    if (state.mode !== 'split') return
    var source = document.querySelector('.vditor-sv')
    var preview = document.querySelector('.vditor-preview')
    if (!source || !preview) return
    ensureSplitDivider()
    bindSplitLineNumbers()
    source.dataset.eyanScrollSync = '1'
    preview.dataset.eyanScrollSync = '1'
  }

  var SOURCE_HIGHLIGHT_NAMES = [
    'eyan-source-base',
    'eyan-source-muted',
    'eyan-source-blue',
    'eyan-source-green',
    'eyan-source-gold',
    'eyan-source-cyan',
    'eyan-source-orange',
    'eyan-source-purple',
    'eyan-source-red',
    'eyan-source-code-keyword',
    'eyan-source-code-title',
    'eyan-source-code-blue',
    'eyan-source-code-string',
    'eyan-source-code-orange',
    'eyan-source-code-comment',
    'eyan-source-code-green',
    'eyan-source-code-red'
  ]

  function buildTextRangeIndex(root, visibleOnly) {
    if (!root) return null
    var entries = []
    var text = ''
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    var node
    var lastBlock = null
    while ((node = walker.nextNode())) {
      var parent = node.parentElement
      if (!parent || parent.closest('[data-eyan-source-tool]')) continue
      if (visibleOnly) {
        if (parent.closest('.vditor-ir__marker:not(pre), [data-type$="-marker"], .vditor-ir__preview, .vditor-copy, button, textarea, .eyan-code-line-numbers, [contenteditable="false"]')) continue
        var sourceCode = parent.closest('pre.vditor-ir__marker--pre code')
        if (!sourceCode && (!parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden')) continue
        var block = parent.closest('[data-block="0"], td, th')
        if (lastBlock && block !== lastBlock) text += '\n'
        lastBlock = block
      }
      var value = node.data || ''
      entries.push({ node: node, start: text.length, end: text.length + value.length })
      text += value
    }
    function locate(offset, endBias) {
      if (!entries.length) return null
      offset = Math.max(0, Math.min(text.length, offset))
      var low = 0
      var high = entries.length - 1
      while (low <= high) {
        var mid = (low + high) >> 1
        var entry = entries[mid]
        if (offset < entry.start) high = mid - 1
        else if (offset > entry.end || (!endBias && offset === entry.end && mid < entries.length - 1)) low = mid + 1
        else return { node: entry.node, offset: Math.max(0, Math.min(entry.node.length, offset - entry.start)) }
      }
      var fallback = entries[Math.max(0, Math.min(entries.length - 1, endBias ? high : low))]
      return fallback ? { node: fallback.node, offset: endBias ? fallback.node.length : 0 } : null
    }
    function offsetForPoint(pointNode, pointOffset, endBias) {
      if (!pointNode || (pointNode !== root && !root.contains(pointNode))) return null
      if (pointNode.nodeType === Node.TEXT_NODE) {
        for (var index = 0; index < entries.length; index++) {
          if (entries[index].node === pointNode) return entries[index].start + Math.max(0, Math.min(pointNode.length, pointOffset))
        }
        return null
      }
      var children = pointNode.childNodes || []
      var candidate = null
      if (pointOffset < children.length) {
        candidate = children[pointOffset]
        for (var forward = 0; forward < entries.length; forward++) {
          if (candidate === entries[forward].node || (candidate.contains && candidate.contains(entries[forward].node))) return entries[forward].start
        }
      }
      if (pointOffset > 0 && children.length) {
        candidate = children[Math.min(pointOffset, children.length) - 1]
        for (var backward = entries.length - 1; backward >= 0; backward--) {
          if (candidate === entries[backward].node || (candidate.contains && candidate.contains(entries[backward].node))) return entries[backward].end
        }
      }
      return endBias ? text.length : 0
    }
    return {
      root: root,
      text: text,
      entries: entries,
      offsetForPoint: offsetForPoint,
      range: function (start, end) {
        if (end <= start) return null
        var from = locate(start, false)
        var to = locate(end, true)
        if (!from || !to) return null
        try {
          var range = document.createRange()
          range.setStart(from.node, from.offset)
          range.setEnd(to.node, to.offset)
          return range
        } catch (_) {
          return null
        }
      }
    }
  }

  function clearSplitSyntaxHighlights() {
    if (!window.CSS || !CSS.highlights) return
    SOURCE_HIGHLIGHT_NAMES.forEach(function (name) { CSS.highlights.delete(name) })
  }

  function clearSplitSameTextHighlights() {
    if (window.CSS && CSS.highlights) CSS.highlights.delete('eyan-source-same-text')
  }

  function rangesAreEqual(left, right) {
    try {
      return left.compareBoundaryPoints(Range.START_TO_START, right) === 0 && left.compareBoundaryPoints(Range.END_TO_END, right) === 0
    } catch (_) { return false }
  }

  function renderSplitSameTextHighlights() {
    splitSameTextFrame = null
    clearSplitSameTextHighlights()
    if (state.mode !== 'split' || !window.CSS || !CSS.highlights || typeof window.Highlight !== 'function') return
    var source = document.querySelector('.vditor-sv.vditor-reset') || document.querySelector('.vditor-sv')
    var selection = window.getSelection()
    if (!source || !selection || selection.rangeCount !== 1 || !selection.toString() || !source.contains(selection.anchorNode) || !source.contains(selection.focusNode)) return
    var selectedRange
    try { selectedRange = selection.getRangeAt(0).cloneRange() } catch (_) { return }
    var index = splitSourceToolsCache && splitSourceToolsCache.source === source ? splitSourceToolsCache.index : buildSplitSourceRangeIndex(source)
    if (!index) return
    var selectedText = selection.toString()
    var matches = []
    var start = index.text.indexOf(selectedText)
    while (start >= 0) {
      var range = index.range(start, start + selectedText.length)
      if (range && !rangesAreEqual(range, selectedRange)) matches.push(range)
      start = index.text.indexOf(selectedText, start + selectedText.length)
    }
    if (matches.length) CSS.highlights.set('eyan-source-same-text', createCssHighlight(matches))
  }

  function scheduleSplitSameTextHighlights() {
    if (splitSameTextFrame) return
    splitSameTextFrame = requestAnimationFrame(renderSplitSameTextHighlights)
  }

  function buildSplitSourceRangeIndex(source) {
    var domIndex = buildTextRangeIndex(source, false)
    var editor = getEditor()
    if (!domIndex || !editor) return domIndex
    var text = editor.getValue()
    if (text === domIndex.text) {
      domIndex.documentOffset = domIndex.offsetForPoint
      return domIndex
    }
    var sourceLines = domIndex.text.split('\n')
    var documentLines = text.split('\n')
    var lineMap = mapSplitSourceLines(sourceLines, documentLines)
    var documentStarts = []
    var position = 0
    documentLines.forEach(function (line) { documentStarts.push(position); position += line.length + 1 })
    var mapped = []
    position = 0
    sourceLines.forEach(function (line, index) {
      var number = lineMap[index]
      if (number && line === documentLines[number - 1]) mapped.push({ start: documentStarts[number - 1], end: documentStarts[number - 1] + line.length, dom: position })
      position += line.length + 1
    })
    function offset(at, endBias) {
      for (var index = 0; index < mapped.length; index++) {
        var line = mapped[index]
        if (at >= line.start && (at < line.end || (endBias && at === line.end))) return line.dom + at - line.start
      }
      return null
    }
    function documentOffset(pointNode, pointOffset, endBias) {
      var domAt = domIndex.offsetForPoint(pointNode, pointOffset, endBias)
      if (domAt == null) return null
      for (var index = 0; index < mapped.length; index++) {
        var line = mapped[index]
        var domEnd = line.dom + (line.end - line.start)
        if (domAt >= line.dom && (domAt < domEnd || (endBias && domAt === domEnd))) return line.start + domAt - line.dom
      }
      return null
    }
    return { root: source, text: text, entries: domIndex.entries, documentOffset: documentOffset, range: function (start, end) {
      var from = offset(start, false)
      var to = offset(end, true)
      return from == null || to == null ? null : domIndex.range(from, to)
    } }
  }

  function lineAtOffset(text, offset) {
    return text.slice(0, Math.max(0, Math.min(text.length, offset))).split('\n').length - 1
  }

  function selectionSurface(selection) {
    if (!selection || selection.rangeCount !== 1 || !selection.anchorNode || !selection.focusNode) return null
    var surfaces = []
    if (state.mode === 'split') {
      surfaces.push({ root: document.querySelector('.vditor-sv.vditor-reset') || document.querySelector('.vditor-sv'), exact: true })
      surfaces.push({ root: document.querySelector('.vditor-preview .vditor-reset'), exact: false })
    } else {
      surfaces.push({ root: getReset(), exact: false })
    }
    for (var index = 0; index < surfaces.length; index++) {
      var root = surfaces[index].root
      if (root && root.contains(selection.anchorNode) && root.contains(selection.focusNode)) return surfaces[index]
    }
    return null
  }

  function readActiveSelection() {
    var selection = window.getSelection()
    var surface = selectionSurface(selection)
    // Losing focus to the toolbar, outline, or Agent UI must preserve the last
    // valid Markdown selection, so selections outside the document are ignored.
    if (!surface) return undefined
    if (selection.isCollapsed || !selection.toString()) {
      return null
    }
    if (surface.exact) {
      var index = buildSplitSourceRangeIndex(surface.root)
      var range
      try { range = selection.getRangeAt(0) } catch (_) { return }
      var start = index && index.documentOffset ? index.documentOffset(range.startContainer, range.startOffset, false) : null
      var end = index && index.documentOffset ? index.documentOffset(range.endContainer, range.endOffset, true) : null
      if (start != null && end != null && end >= start) {
        return {
          text: index.text.slice(start, end),
          startOffset: start,
          endOffset: end,
          startLine: lineAtOffset(index.text, start),
          endLine: lineAtOffset(index.text, end),
          accuracy: 'exact'
        }
      }
    }
    return { text: selection.toString(), accuracy: 'rendered-text' }
  }

  function sendActiveSelection() {
    activeSelectionTimer = null
    if (!window.vscode || typeof window.vscode.postMessage !== 'function') return
    window.vscode.postMessage({ command: 'markdown-editor:active-selection', selection: pendingActiveSelection })
  }

  function scheduleActiveSelection() {
    var nextSelection = readActiveSelection()
    if (nextSelection === undefined) return
    pendingActiveSelection = nextSelection
    clearTimeout(activeSelectionTimer)
    activeSelectionTimer = setTimeout(sendActiveSelection, 150)
  }

  function createCssHighlight(ranges) {
    return new (Function.prototype.bind.apply(window.Highlight, [null].concat(ranges)))()
  }

  function addSyntaxSpan(spans, start, end, role) {
    if (end <= start || SOURCE_HIGHLIGHT_NAMES.indexOf('eyan-source-' + role) < 0) return
    spans.push({ start: start, end: end, role: role })
  }

  function semanticRoleForHljsClass(className) {
    if (/\bhljs-(keyword|doctag|template-tag|template-variable|type)\b/.test(className)) return 'code-keyword'
    if (/\bhljs-(title|class)\b/.test(className)) return 'code-title'
    if (/\bhljs-(attr|attribute|literal|meta|variable|params|property)\b/.test(className)) return 'code-blue'
    if (/\bhljs-(string|regexp|subst)\b/.test(className)) return 'code-string'
    if (/\bhljs-(built_in|symbol)\b/.test(className)) return 'code-orange'
    if (/\bhljs-(comment|code|formula)\b/.test(className)) return 'code-comment'
    if (/\bhljs-(name|quote|selector-tag|selector-pseudo)\b/.test(className)) return 'code-green'
    if (/\bhljs-(deletion)\b/.test(className)) return 'code-red'
    return ''
  }

  function collectMermaidSpans(code, baseOffset, spans) {
    var offset = baseOffset
    code.split('\n').forEach(function (line) {
      var keyword = /\b(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt)\b/g
      var match
      while ((match = keyword.exec(line))) addSyntaxSpan(spans, offset + match.index, offset + match.index + match[0].length, 'blue')
      // Mermaid flow lines: blue connectors, red node and edge labels, and
      // base-color identifiers. This mirrors the rendered code palette while
      // keeping A/B/C-style node IDs visually distinct from their labels.
      var connector = /(?:<-->|<--|-->|-\.->|==>|---|--|==)/g
      while ((match = connector.exec(line))) addSyntaxSpan(spans, offset + match.index, offset + match.index + match[0].length, 'blue')
      var nodeLabel = /\[[^\]\n]*\]|\{[^}\n]*\}|\([^\)\n]*\)/g
      while ((match = nodeLabel.exec(line))) {
        var inner = match[0][0] === '(' ? 0 : 1
        addSyntaxSpan(spans, offset + match.index + inner, offset + match.index + match[0].length - inner, 'red')
      }
      var edgeLabel = /(?:--|==)\s*([^\-=>\n][^\n]*?)\s*(?=-->|==>|-\.->)/g
      while ((match = edgeLabel.exec(line))) {
        var labelStart = match.index + match[0].indexOf(match[1])
        addSyntaxSpan(spans, offset + labelStart, offset + labelStart + match[1].length, 'red')
      }
      offset += line.length + 1
    })
  }

  // Languages that render as pictures rather than text. Their fences get a
  // diagram-specific treatment, so they must not fall through to hljs.
  var DIAGRAM_FENCE_LANGUAGES = /^(?:mermaid|flowchart|graphviz|echarts|markmap|mindmap|plantuml|abc)$/

  function collectHljsSpans(code, language, baseOffset, spans) {
    if (/^(yaml|yml)$/.test(language)) {
      var yamlOffset = baseOffset
      code.split('\n').forEach(function (line) { collectYamlLineSpans(line, yamlOffset, spans); yamlOffset += line.length + 1 })
      return true
    }
    if (/^mermaid$/.test(language)) { collectMermaidSpans(code, baseOffset, spans); return true }
    if (!language || DIAGRAM_FENCE_LANGUAGES.test(language)) return false
    if (!window.hljs || typeof window.hljs.highlight !== 'function') return false
    // Let hljs decide what it can parse. The bundle ships ~200 grammars, so an
    // explicit allow-list would silently drop colors the rendered block shows.
    if (!window.hljs.getLanguage || !window.hljs.getLanguage(language)) return false
    try {
      var highlighted = window.hljs.highlight(code, { language: language || 'plaintext', ignoreIllegals: true })
      if (!highlighted || !highlighted.value) return false
      var template = document.createElement('template')
      template.innerHTML = highlighted.value
      var offset = 0
      var walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
      var node
      while ((node = walker.nextNode())) {
        var length = node.data.length
        var parent = node.parentElement
        var role = ''
        while (parent && parent !== template.content) {
          role = role || semanticRoleForHljsClass(parent.className || '')
          parent = parent.parentElement
        }
        if (role) addSyntaxSpan(spans, baseOffset + offset, baseOffset + offset + length, role)
        offset += length
      }
      return offset === code.length
    } catch (_) {
      return false
    }
  }

  function collectFallbackCodeSpans(code, baseOffset, spans) {
    var patterns = [
      { role: 'green', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|(^|\s)#[^\n]*/gm },
      { role: 'orange', regex: /(['"`])(?:\\.|(?!\1)[^\\])*\1/g },
      { role: 'purple', regex: /\/(?:\\.|[^/\n])+\/[gimsuy]*/g },
      { role: 'blue', regex: /\b(?:async|await|break|case|catch|class|const|continue|def|del|elif|else|export|extends|finally|for|from|function|if|import|in|interface|let|new|of|pass|raise|return|switch|throw|try|var|while|with|yield|subgraph|flowchart|graph|digraph)\b/g },
      { role: 'green', regex: /\b(?:true|false|null|none|undefined)\b/gi },
      { role: 'cyan', regex: /\b[A-Za-z_$][\w$]*(?=\s*\()/g },
      { role: 'base', regex: /(?:-->|==>|->|=>|===|!==|==|!=|<=|>=|&&|\|\||[+*/%=<>-])/g }
    ]
    patterns.forEach(function (pattern) {
      pattern.regex.lastIndex = 0
      var match
      while ((match = pattern.regex.exec(code))) {
        var value = match[0]
        var leading = pattern.role === 'green' && value[0] && /\s/.test(value[0]) ? 1 : 0
        addSyntaxSpan(spans, baseOffset + match.index + leading, baseOffset + match.index + value.length, pattern.role)
        if (!value.length) pattern.regex.lastIndex++
      }
    })
  }

  function collectInlineMarkdownSpans(line, offset, spans) {
    // Code spans and link/image syntax own their ranges: emphasis markers
    // inside them (e.g. underscores in code or file paths) must not recolor.
    var reserved = []
    var match
    var inlineCode = /`[^`\n]+`/g
    while ((match = inlineCode.exec(line))) {
      addSyntaxSpan(spans, offset + match.index, offset + match.index + match[0].length, 'orange')
      reserved.push([match.index, match.index + match[0].length])
    }
    var linkRegex = /(!?)\[([^\]]+)\]\(([^)]+)\)/g
    var link
    while ((link = linkRegex.exec(line))) {
      if (reserved.some(function (r) { return link.index < r[1] && r[0] < link.index + link[0].length })) continue
      var linkNameStart = offset + link.index + link[1].length
      addSyntaxSpan(spans, linkNameStart + 1, linkNameStart + link[2].length + 1, 'red')
      var linkPathStart = linkNameStart + link[2].length + 3
      addSyntaxSpan(spans, linkPathStart, linkPathStart + link[3].length, 'blue')
      reserved.push([link.index, link.index + link[0].length])
    }
    var patterns = [
      { role: 'muted', regex: /~~[^\n]+?~~/g },
      { role: 'blue', regex: /(?:\*\*|__)[^\n]+?(?:\*\*|__)/g },
      { role: 'purple', regex: /(?:^|[^*])\*[^*\n]+\*|(?:^|[^_])_[^_\n]+_/g }
    ]
    patterns.forEach(function (pattern) {
      pattern.regex.lastIndex = 0
      var m
      while ((m = pattern.regex.exec(line))) {
        var leading = (pattern.role === 'purple' && m[0].length && !/[*_]/.test(m[0][0])) ? 1 : 0
        var start = m.index + leading
        var end = m.index + m[0].length
        if (reserved.some(function (r) { return start < r[1] && r[0] < end })) continue
        addSyntaxSpan(spans, offset + start, offset + end, pattern.role)
      }
    })
    var strongEmphasis = /\*\*\*([^*\n]+)\*\*\*|___([^_\n]+)___/g
    var emphasis
    while ((emphasis = strongEmphasis.exec(line))) {
      if (reserved.some(function (r) { return emphasis.index < r[1] && r[0] < emphasis.index + emphasis[0].length })) continue
      addSyntaxSpan(spans, offset + emphasis.index, offset + emphasis.index + emphasis[0].length, 'blue')
      addSyntaxSpan(spans, offset + emphasis.index + 3, offset + emphasis.index + emphasis[0].length - 3, 'purple')
    }
  }

  function collectYamlLineSpans(line, offset, spans) {
    // YAML values share one color, including strings, numbers and booleans.
    var quote = ''
    var comment = line.length
    for (var i = 0; i < line.length; i++) {
      var char = line[i]
      if (quote) {
        if (char === '\\' && quote === '"') { i++; continue }
        if (char === quote) quote = ''
      } else if (char === '"' || char === "'") quote = char
      else if (char === '#' && (i === 0 || /\s/.test(line[i - 1]))) { comment = i; break }
    }
    var content = line.slice(0, comment)
    var key = content.match(/^(\s*(?:-\s+)?)("(?:\\.|[^"\\])*"|'[^']*'|[^:#\s][^:]*?)(\s*:(?:\s+|$))/)
    var valueStart = 0
    if (key) {
      addSyntaxSpan(spans, offset + key[1].length, offset + key[1].length + key[2].length, 'blue')
      valueStart = key[0].length
    } else {
      var prefix = content.match(/^\s*(?:-\s+)?/)
      valueStart = prefix[0].length
    }
    addSyntaxSpan(spans, offset + valueStart, offset + content.trimEnd().length, 'orange')
    if (comment < line.length) addSyntaxSpan(spans, offset + comment, offset + line.length, 'green')
  }

  function collectSplitSyntaxSpans(text) {
    var spans = []
    var lines = text.split('\n')
    var offset = 0
    var frontMatter = frontMatterRange(text)
    var fence = null
    for (var index = 0; index < lines.length; index++) {
      var line = lines[index]
      if (frontMatter && index >= frontMatter.open && index <= frontMatter.close) {
        if (index === frontMatter.open || index === frontMatter.close) {
          addSyntaxSpan(spans, offset, offset + line.length, 'muted')
        } else collectYamlLineSpans(line, offset, spans)
        offset += line.length + 1
        continue
      }
      if (fence) {
        if (new RegExp('^\\s*' + (fence.char === '`' ? '`' : '~') + '{' + fence.length + ',}\\s*$').test(line)) {
          var codeEnd = Math.max(fence.codeStart, offset - 1)
          var code = text.slice(fence.codeStart, codeEnd)
          if (!collectHljsSpans(code, fence.language, fence.codeStart, spans) && /^mermaid$/.test(fence.language)) collectMermaidSpans(code, fence.codeStart, spans)
          addSyntaxSpan(spans, offset, offset + line.length, 'muted')
          fence = null
        }
        offset += line.length + 1
        continue
      }
      var open = line.match(/^\s*(`{3,}|~{3,})\s*([^\s`]*)?.*$/)
      if (open) {
        addSyntaxSpan(spans, offset, offset + line.length, 'muted')
        fence = { char: open[1][0], length: open[1].length, language: (open[2] || 'plaintext').toLowerCase(), codeStart: offset + line.length + 1 }
        offset += line.length + 1
        continue
      }
      var heading = line.match(/^\s{0,3}#{1,6}\s+/)
      if (heading) addSyntaxSpan(spans, offset, offset + line.length, 'blue')
      var quote = line.match(/^\s*>+/)
      if (quote) addSyntaxSpan(spans, offset, offset + line.length, 'green')
      var listMarker = line.match(/^(\s*)(?:\d+[.)]|[-*+])(?=\s)/)
      if (listMarker) {
        addSyntaxSpan(spans, offset + listMarker[1].length, offset + listMarker[0].length, 'orange')
        var task = /^\s+(\[[ xX]\])(?=\s|$)/.exec(line.slice(listMarker[0].length))
        if (task) {
          var taskStart = offset + listMarker[0].length + task.index + task[0].indexOf(task[1])
          addSyntaxSpan(spans, taskStart + 1, taskStart + task[1].length - 1, 'red')
        }
      }
      collectInlineMarkdownSpans(line, offset, spans)
      offset += line.length + 1
    }
    if (fence) {
      var rest = text.slice(fence.codeStart)
      if (!collectHljsSpans(rest, fence.language, fence.codeStart, spans) && /^mermaid$/.test(fence.language)) collectMermaidSpans(rest, fence.codeStart, spans)
    }
    return spans
  }

  function paintSplitSyntax(index, spans) {
    clearSplitSyntaxHighlights()
    if (!window.CSS || !CSS.highlights || typeof window.Highlight !== 'function') return
    var grouped = Object.create(null)
    SOURCE_HIGHLIGHT_NAMES.forEach(function (name) { grouped[name] = [] })
    var baseRange = index.range(0, index.text.length)
    if (baseRange) grouped['eyan-source-base'].push(baseRange)
    spans.forEach(function (span) {
      var range = index.range(span.start, span.end)
      if (range) grouped['eyan-source-' + span.role].push(range)
    })
    SOURCE_HIGHLIGHT_NAMES.forEach(function (name) {
      if (grouped[name].length) CSS.highlights.set(name, createCssHighlight(grouped[name]))
    })
  }

  function sourceSurfaceIsDark(source) {
    var match
    for (var surface = source; surface; surface = surface.parentElement) {
      match = getComputedStyle(surface).backgroundColor.match(/[\d.]+/g)
      if (match && match.length >= 3 && (match.length < 4 || Number(match[3]) > 0)) break
      match = null
    }
    if (!match || match.length < 3) return state.vscodeDark
    var channels = match.slice(0, 3).map(function (value) {
      var channel = Number(value) / 255
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2] < 0.42
  }

  function renderSplitSourceTools(force) {
    splitSourceToolsTimer = null
    var source = document.querySelector('.vditor-sv.vditor-reset') || document.querySelector('.vditor-sv')
    if (state.mode !== 'split' || !source) {
      clearSplitSyntaxHighlights()
      clearSplitSameTextHighlights()
      splitSourceToolsCache = null
      return
    }
    restoreSplitHorizontalRuleSurface()
    if (splitSourceComposing) {
      // Keep the current highlights while an IME composition is in flight:
      // clearing them flashes the whole pane to base colour until commit.
      // Vditor does not re-parse the source during composition, so the painted
      // live Ranges stay attached; compositionend forces a full repaint.
      return
    }
    var index = buildSplitSourceRangeIndex(source)
    if (!index) return
    var dark = sourceSurfaceIsDark(source)
    document.body.classList.toggle('eyan-source-dark', dark)
    var signature = index.text + '\u0000' + (dark ? 'dark' : 'light')
    if (!force && splitSourceToolsCache && splitSourceToolsCache.source === source && splitSourceToolsCache.signature === signature) {
      // Vditor can replace its text nodes without changing the Markdown.
      // Reuse parsed tokens, but never keep ranges into detached DOM nodes.
      splitSourceToolsCache.index = index
      paintSplitSyntax(index, splitSourceToolsCache.syntax)
      scheduleSplitSameTextHighlights()
      return
    }
    splitSourceToolsCache = {
      source: source,
      index: index,
      signature: signature,
      syntax: collectSplitSyntaxSpans(index.text)
    }
    paintSplitSyntax(index, splitSourceToolsCache.syntax)
    scheduleSplitSameTextHighlights()
  }

  function scheduleSplitSourceTools(force) {
    clearTimeout(splitSourceToolsTimer)
    splitSourceToolsTimer = setTimeout(function () { renderSplitSourceTools(force) }, force ? 0 : 90)
  }

  function escapeSearchRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function clearFindHighlights() {
    if (!window.CSS || !CSS.highlights) return
    CSS.highlights.delete('eyan-search-results')
    CSS.highlights.delete('eyan-search-current')
  }

  function createFindReplaceController() {
    var bar = document.createElement('div')
    bar.id = 'eyan-find-bar'
    bar.setAttribute('data-eyan-source-tool', '1')
    bar.setAttribute('aria-hidden', 'true')
    bar.innerHTML = '<div class="eyan-find-row"><button class="eyan-find-toggle" type="button" title="Toggle replace" aria-label="Toggle replace">›</button><input class="eyan-find-input" type="text" placeholder="Find…" spellcheck="false" autocomplete="off"><span class="eyan-find-count"></span><button class="eyan-find-prev" type="button" title="Previous match">↑</button><button class="eyan-find-next" type="button" title="Next match">↓</button><label class="eyan-find-case" title="Match case"><input type="checkbox">Aa</label><button class="eyan-find-close" type="button" title="Close">×</button></div><div class="eyan-replace-row"><span></span><input class="eyan-replace-input" type="text" placeholder="Replace…" spellcheck="false" autocomplete="off"><button class="eyan-replace-one" type="button" title="Replace current">Replace</button><button class="eyan-replace-all" type="button" title="Replace all">All</button></div>'
    document.body.appendChild(bar)
    var findInput = bar.querySelector('.eyan-find-input')
    var replaceInput = bar.querySelector('.eyan-replace-input')
    var count = bar.querySelector('.eyan-find-count')
    var caseInput = bar.querySelector('.eyan-find-case input')
    var matches = []
    var current = -1
    var open = false
    var rootIndex = null
    var updateTimer

    function activeRoot() {
      if (state.mode === 'split') return document.querySelector('.vditor-sv.vditor-reset') || document.querySelector('.vditor-sv')
      return document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-wysiwyg .vditor-reset')
    }
    function paint() {
      clearFindHighlights()
      if (!window.CSS || !CSS.highlights || typeof window.Highlight !== 'function') return
      var ranges = matches.map(function (match) { return match.range }).filter(Boolean)
      if (ranges.length) CSS.highlights.set('eyan-search-results', createCssHighlight(ranges))
      if (current >= 0 && matches[current] && matches[current].range) CSS.highlights.set('eyan-search-current', createCssHighlight([matches[current].range]))
    }
    function updateCount() {
      count.textContent = matches.length ? (current + 1) + '/' + matches.length : (findInput.value ? '0/0' : '')
      count.classList.toggle('eyan-no-match', !!findInput.value && !matches.length)
      bar.querySelector('.eyan-replace-one').disabled = current < 0 || state.mode === 'readonly'
      bar.querySelector('.eyan-replace-all').disabled = !matches.length || state.mode === 'readonly'
    }
    function reveal() {
      if (current < 0 || !matches[current]) return
      try {
        var node = matches[current].range.startContainer.parentElement
        if (node) node.scrollIntoView({ block: 'nearest' })
      } catch (_) {}
    }
    function rebuild(keepNearest) {
      matches = []
      var query = findInput.value
      var root = activeRoot()
      rootIndex = state.mode === 'split' ? buildSplitSourceRangeIndex(root) : buildTextRangeIndex(root, true)
      if (query && rootIndex) {
        var flags = caseInput.checked ? 'g' : 'gi'
        var regex = new RegExp(escapeSearchRegex(query), flags)
        var match
        while ((match = regex.exec(rootIndex.text))) {
          var range = rootIndex.range(match.index, match.index + match[0].length)
          if (range || state.mode === 'split') matches.push({ start: match.index, end: match.index + match[0].length, value: match[0], range: range })
          if (!match[0].length) regex.lastIndex++
        }
      }
      current = matches.length ? Math.max(0, Math.min(keepNearest ? current : 0, matches.length - 1)) : -1
      paint()
      updateCount()
      if (current >= 0) reveal()
    }
    function scheduleRebuild() {
      clearTimeout(updateTimer)
      updateTimer = setTimeout(function () { if (open) rebuild(true) }, 80)
    }
    function move(delta) {
      if (!matches.length) return
      current = (current + delta + matches.length) % matches.length
      paint(); updateCount(); reveal()
    }
    function replaceRange(match, value) {
      if (!match) return false
      try {
        if (state.mode === 'split') {
          var editor = getEditor()
          var markdown = editor.getValue()
          var next = markdown.slice(0, match.start) + value + markdown.slice(match.end)
          state.documentText = next
          editor.setValue(next, false)
          if (typeof editor.vditor.options.input === 'function') editor.vditor.options.input(next)
          return true
        }
        if (state.mode !== 'split') {
          var pieces = rootIndex.entries.filter(function (entry) { return entry.end > match.start && entry.start < match.end })
          pieces.forEach(function (entry, index) {
            var start = Math.max(0, match.start - entry.start)
            var end = Math.min(entry.node.length, match.end - entry.start)
            entry.node.replaceData(start, end - start, index === 0 ? value : '')
          })
          return true
        }
      } catch (_) {
        return false
      }
    }
    function replaceCurrent() {
      if (state.mode === 'readonly') return
      if (current < 0 || !matches[current]) return
      beginEditReplacement()
      replaceRange(matches[current], replaceInput.value)
      finishEditReplacement()
      findInput.focus()
      scheduleRebuild()
    }
    function replaceAll() {
      if (state.mode === 'readonly') return
      if (!matches.length) return
      if (state.mode === 'split') {
        var editor = getEditor()
        if (!editor) return
        var flags = caseInput.checked ? 'g' : 'gi'
        var next = editor.getValue().replace(new RegExp(escapeSearchRegex(findInput.value), flags), function () { return replaceInput.value })
        state.documentText = next
        editor.setValue(next, false)
        try {
          if (typeof editor.vditor.options.input === 'function') editor.vditor.options.input(next)
        } catch (_) {}
      } else {
        beginEditReplacement()
        matches.slice().reverse().forEach(function (match) { replaceRange(match, replaceInput.value) })
        finishEditReplacement()
      }
      findInput.focus()
      scheduleRebuild()
    }
    function beginEditReplacement() {
      if (state.mode === 'split') return
      var editor = getEditor()
      if (editor) editor.vditor.undo.addToUndoStack(editor.vditor)
    }
    function finishEditReplacement() {
      if (state.mode === 'split' || !rootIndex) return
      rootIndex.root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    }
    function show() {
      open = true
      bar.classList.add('eyan-open')
      bar.setAttribute('aria-hidden', 'false')
      findInput.focus()
      findInput.select()
      rebuild(false)
    }
    function hide() {
      open = false
      bar.classList.remove('eyan-open')
      bar.setAttribute('aria-hidden', 'true')
      clearFindHighlights()
      matches = []
      current = -1
    }
    bar.querySelector('.eyan-find-toggle').addEventListener('click', function () {
      bar.classList.toggle('eyan-replace-open')
      bar.querySelector('.eyan-find-toggle').textContent = bar.classList.contains('eyan-replace-open') ? '⌄' : '›'
      if (bar.classList.contains('eyan-replace-open')) replaceInput.focus()
    })
    findInput.addEventListener('input', function () { rebuild(false) })
    caseInput.addEventListener('change', function () { rebuild(false) })
    findInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); move(event.shiftKey ? -1 : 1) }
      else if (event.key === 'Escape') { event.preventDefault(); hide() }
    })
    replaceInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); replaceCurrent() }
      else if (event.key === 'Escape') { event.preventDefault(); hide() }
    })
    bar.querySelector('.eyan-find-prev').addEventListener('click', function () { move(-1) })
    bar.querySelector('.eyan-find-next').addEventListener('click', function () { move(1) })
    bar.querySelector('.eyan-find-close').addEventListener('click', hide)
    bar.querySelector('.eyan-replace-one').addEventListener('click', replaceCurrent)
    bar.querySelector('.eyan-replace-all').addEventListener('click', replaceAll)
    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault(); event.stopPropagation(); show()
      }
    }, true)
    document.addEventListener('input', scheduleRebuild, true)
    return { open: show, close: hide, refresh: scheduleRebuild }
  }

  function ensureFindReplaceController() {
    if (!findReplaceController) {
      findReplaceController = createFindReplaceController()
      window.__vmdSearch = findReplaceController
    }
    return findReplaceController
  }

  function enhanceContent() {
    installMarkdownValueBridge(getEditor())
    ensureOutline()
    enhanceHeadingFolding()
    addCopyButtons()
    enhanceCodeBlocks()
    bindGraphicTools()
    protectRenderedGraphics()
    enhanceFrontMatter()
    schedulePreviewYamlSyntax()
    syncRenderedChartColors()
    observeRenderedChartSizes()
    bindBlockHover()
    enhanceTableEditor()
    enhanceTableBreaks()
    enhanceTableLayouts()
    bindSplitScrollSync()
    bindSplitLineNumbers()
    guardReadonlySurface()
    enhanceReadonlyInteractions()
    enhanceExternalLinks()
    ensureFindReplaceController().refresh()
    scheduleSplitSourceTools()
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer)
    enhanceTimer = setTimeout(function () {
      enhanceContent()
      buildOutline()
    }, 80)
  }

  window.addEventListener('message', function (event) {
    var message = event.data || {}
    if (message.command === 'update' && typeof message.content === 'string') {
      if (message.type === 'init') {
        tableLayoutSessions = Object.create(null)
        tableScrollSessions = Object.create(null)
        tableViewportWidthSessions = Object.create(null)
      }
      state.documentText = message.content
      previewStableMarkdown = normalizedMarkdownText(message.content)
      previewFrontMatterEdit = null
      setTimeout(function () {
        var editor = getEditor()
        if (!editor) return
        // Set the requested surface before loading the document. Vditor IR
        // treats a lone first-line `---` as an incomplete frontmatter block
        // and inserts a closing marker; Split must receive the source in SV
        // mode so the user's literal line remains untouched.
        if (message.editorMode) applyMode(message.editorMode)
        var load = function () {
          var current = getEditor()
          if (!current) return
          installMarkdownValueBridge(current)
          if (typeof current.setValue === 'function') current.setValue(message.content, false)
        }
        // Mode buttons complete their DOM conversion on the next turn. Keep
        // the initial write behind that conversion so IR cannot synthesize a
        // frontmatter close marker before Split receives the literal source.
        if (message.type === 'init' && message.editorMode) setTimeout(load, 140)
        else load()
      }, 0)
    }
    if (message.command === 'markdown-editor:set-mode') applyMode(message.mode)
    if (message.command === 'markdown-editor:set-theme') applyTheme(message.theme)
    if (message.command === 'markdown-editor:insert-document-link' && typeof message.markdown === 'string') {
      var editor = getEditor()
      if (editor) {
        editor.focus()
        restoreInsertRange()
        if (typeof editor.insertMD === 'function') editor.insertMD(message.markdown)
        else editor.insertValue(message.markdown)
      }
    }
    if (message.command === 'markdown-editor:resolved-link-preview' && typeof message.display === 'string') {
      linkPreviewCache.set(message.href, message.display)
      if (activeLinkPreview && activeLinkPreview.requestId === message.requestId && activeLinkPreview.href === message.href) {
        showLinkTooltip(activeLinkPreview.target, message.display)
      }
    }
    if (message.command === 'update' && message.type === 'init') {
      applyOutlinePreferences(message)
      setTimeout(function () {
        applyVscodeTheme(message.theme)
        applyTheme(message.editorTheme || state.theme)
        applyMode(message.editorMode || state.mode)
      }, 80)
    }
  })

  document.addEventListener('scroll', updateOutlineActive, true)
  function horizontalRuleEditOwnsEvent(event) {
    if (!horizontalRuleEdit || !horizontalRuleEdit.editor) return false
    var editor = horizontalRuleEdit.editor
    var target = event && event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    if (target && (target === editor || editor.contains(target))) return true
    if (document.activeElement === editor) return true
    var selection = window.getSelection && window.getSelection()
    var anchor = selection && selection.anchorNode
    return !!(anchor && (anchor === editor || editor.contains(anchor)))
  }
  function horizontalRuleAtPointer(event) {
    var target = event && event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    var direct = target && target.closest && target.closest('.vditor-ir .vditor-reset hr')
    if (direct) return direct
    var reset = document.querySelector('.vditor-ir .vditor-reset')
    if (!reset || !reset.contains(target)) return null
    var x = event.clientX
    var y = event.clientY
    var nearest = null
    var distance = Infinity
    Array.from(reset.querySelectorAll('hr')).forEach(function (rule) {
      var rect = rule.getBoundingClientRect()
      var insideX = x >= rect.left - 8 && x <= rect.right + 8
      var deltaY = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
      if (insideX && deltaY <= 12 && deltaY < distance) {
        nearest = rule
        distance = deltaY
      }
    })
    return nearest
  }

  function previewEditableParagraph() {
    var selection = window.getSelection && window.getSelection()
    var anchor = selection && selection.anchorNode
    var element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)
    return element && element.closest && element.closest('.vditor-ir .vditor-reset p')
  }

  function previewContentBlocks(root) {
    return root ? Array.from(root.children).filter(function (node) {
      return node.id !== 'fix-table-ir-wrapper'
    }) : []
  }

  function incompleteFrontMatterParagraph() {
    if (state.mode !== 'preview') return null
    var root = document.querySelector('.vditor-ir .vditor-reset')
    if (!root) return null
    var blocks = previewContentBlocks(root)
    var first = blocks[0]
    if (!first || first.tagName !== 'P' || first.textContent.trim() !== '---') return null
    var editor = getEditor()
    var source = normalizedMarkdownText(editor && editor.getValue ? editor.getValue() : '')
    if (frontMatterRange(source) && !previewFrontMatterEdit) return null
    return first
  }

  function pendingFrontMatterSource(editor) {
    var source = normalizedMarkdownText(editor && editor.getValue ? editor.getValue() : '')
    var prefix = previewFrontMatterEdit && previewFrontMatterEdit.leadingPrefix
    if (!prefix) {
      var stable = previewStableMarkdown || state.documentText || ''
      if (/^\s*\n/.test(normalizedMarkdownText(stable)) && /^---(?:\n|$)/.test(source)) prefix = leadingMarkdownPrefix(stable)
    }
    if (prefix && source.indexOf(prefix) !== 0) source = prefix + source
    var lines = source.split('\n')
    // Pending frontmatter follows the same position rule as completed
    // frontmatter: only the first physical line may be the opening marker.
    // A leading blank line makes the later `---` an ordinary Markdown token.
    var firstLine = lines[0] || ''
    if (firstLine.charCodeAt(0) === 0xFEFF) firstLine = firstLine.slice(1)
    var open = /^---[ \t]*$/.test(firstLine) ? 0 : -1
    if (open >= 0) {
      // IR paragraphs serialize with an extra blank line. Remove only the
      // synthetic gap around the frontmatter delimiters; user-entered blank
      // lines inside the YAML body remain untouched.
      if (lines[open + 1] === '') lines.splice(open + 1, 1)
      var close = -1
      for (var index = open + 1; index < lines.length; index++) {
        if (/^---[ \t]*$/.test(lines[index])) { close = index; break }
      }
      if (close > open + 1 && lines[close - 1] === '') lines.splice(close - 1, 1)
      source = lines.join('\n')
    }
    return source
  }

  function commitPendingFrontMatter(editor) {
    if (!previewFrontMatterEdit || !editor) return false
    var source = pendingFrontMatterSource(editor)
    previewFrontMatterEdit = null
    editor.setValue(source, false)
    setMarkdownBridgeSource(editor, source)
    return true
  }

  function handleIncompleteFrontMatterInput(event) {
    if (state.mode !== 'preview' || !event || event.type !== 'input') return false
    var editor = getEditor()
    var paragraph = incompleteFrontMatterParagraph()
    if (!editor || !paragraph) return false
    var selection = window.getSelection && window.getSelection()
    var anchor = selection && selection.anchorNode
    var activeInFirstLine = !!(anchor && paragraph.contains(anchor))
    if (!previewFrontMatterEdit && !activeInFirstLine) return false
    if (!previewFrontMatterEdit) {
      previewFrontMatterEdit = { leadingPrefix: leadingMarkdownPrefix(previewStableMarkdown || state.documentText || '') }
    }
    var source = pendingFrontMatterSource(editor)
    if (frontMatterRange(source)) {
      // Keep the completed pair in plain editable paragraphs until the user
      // leaves it or presses Enter; this prevents Vditor from inventing the
      // closing marker while the opening marker is still being typed.
      previewFrontMatterEdit.complete = true
    }
    event.stopPropagation()
    notifyMarkdownEdit(editor, source)
    return true
  }

  function handlePendingFrontMatterKeydown(event) {
    if (state.mode !== 'preview' || !event || !previewFrontMatterEdit) return false
    var editor = getEditor()
    if (!editor) return false
    if (event.key === 'Enter' && previewFrontMatterEdit.complete) {
      event.preventDefault()
      event.stopPropagation()
      commitPendingFrontMatter(editor)
      return true
    }
    if (event.key !== 'Enter') return false
    var selection = window.getSelection && window.getSelection()
    var anchor = selection && selection.anchorNode
    var element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)
    var paragraph = element && element.closest && element.closest('.vditor-ir .vditor-reset p')
    if (!paragraph) return false
    event.preventDefault()
    event.stopPropagation()
    var next = document.createElement('p')
    next.setAttribute('data-block', '0')
    var range = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    var text = document.createTextNode('')
    if (range && paragraph.contains(range.startContainer)) {
      var trailing = range.cloneRange()
      trailing.selectNodeContents(paragraph)
      trailing.setStart(range.endContainer, range.endOffset)
      var fragment = trailing.extractContents()
      if (fragment.textContent) next.appendChild(fragment)
      else next.appendChild(text)
    } else next.appendChild(text)
    paragraph.parentNode.insertBefore(next, paragraph.nextSibling)
    var range = document.createRange()
    range.setStart(text, 0)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    notifyMarkdownEdit(editor, pendingFrontMatterSource(editor))
    return true
  }

  function selectionPrefixWithin(node, selection) {
    if (!node || !selection || !selection.rangeCount || !node.contains(selection.anchorNode)) return null
    var before = selection.getRangeAt(0).cloneRange()
    before.selectNodeContents(node)
    before.setEnd(selection.anchorNode, selection.anchorOffset)
    return before.toString()
  }

  // Vditor inherits the heading block's class when Enter is pressed before
  // the first `#`. Create a real paragraph ourselves so the new line starts
  // as body text immediately, without requiring a second Enter.
  function handleHeadingStartEnter(event) {
    if (state.mode === 'readonly' || !event || event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false
    var selection = window.getSelection && window.getSelection()
    if (!selection || !selection.isCollapsed) return false
    var anchor = selection.anchorNode
    var element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)
    var block = element && element.closest && element.closest('.vditor-ir .vditor-reset h1, .vditor-ir .vditor-reset h2, .vditor-ir .vditor-reset h3, .vditor-ir .vditor-reset h4, .vditor-ir .vditor-reset h5, .vditor-ir .vditor-reset h6, .vditor-sv [data-block]')
    if (!block) return false
    var text = (block.textContent || '').replace(/\u200b/g, '')
    var isSplitHeading = state.mode === 'split' && (/^\s*#{1,6}(?:\s|$)/.test(text) || block.classList.contains('h1') || block.classList.contains('h2') || block.classList.contains('h3') || block.classList.contains('h4') || block.classList.contains('h5') || block.classList.contains('h6'))
    var isPreviewHeading = state.mode === 'preview' && /^H[1-6]$/.test(block.tagName)
    if (!isSplitHeading && !isPreviewHeading) return false
    var prefix = selectionPrefixWithin(block, selection)
    if (prefix === null || prefix.length > 0) return false
    event.preventDefault()
    event.stopPropagation()
    var next = document.createElement(state.mode === 'split' ? 'div' : 'p')
    next.setAttribute('data-block', '0')
    if (state.mode === 'split') next.className = 'p'
    var caret = document.createElement('wbr')
    next.appendChild(caret)
    block.parentNode.insertBefore(next, block)
    var range = document.createRange()
    range.setStartBefore(caret)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    var editor = getEditor()
    if (editor) notifyMarkdownEdit(editor, nativeMarkdownValue(editor))
    return true
  }

  // A plain `#` pasted at the end of a line is text. Insert it into the active
  // block before Vditor's Markdown paste handler can create a new heading.
  function pastedPlainText(event) {
    if (!event) return ''
    if (event.clipboardData && typeof event.clipboardData.getData === 'function') return event.clipboardData.getData('text/plain')
    if (event.dataTransfer && typeof event.dataTransfer.getData === 'function') return event.dataTransfer.getData('text/plain')
    return typeof event.data === 'string' ? event.data : ''
  }

  function handleTrailingHashPaste(event) {
    if (state.mode === 'readonly' || !event) return false
    var text = pastedPlainText(event)
    if (text !== '#') return false
    var selection = window.getSelection && window.getSelection()
    if (!selection || !selection.isCollapsed || !selection.rangeCount) return false
    var anchor = selection.anchorNode
    var element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)
    var surface = element && element.closest && element.closest('.vditor-ir .vditor-reset, .vditor-sv')
    var block = element && element.closest && element.closest('.vditor-ir .vditor-reset p, .vditor-ir .vditor-reset h1, .vditor-ir .vditor-reset h2, .vditor-ir .vditor-reset h3, .vditor-ir .vditor-reset h4, .vditor-ir .vditor-reset h5, .vditor-ir .vditor-reset h6, .vditor-sv [data-block]')
    if (!surface || !block || !surface.contains(block)) return false
    var after = selection.getRangeAt(0).cloneRange()
    after.setEndAfter(block)
    if (after.toString().trim()) return false
    event.preventDefault()
    event.stopImmediatePropagation()
    var range = selection.getRangeAt(0)
    range.deleteContents()
    var node = document.createTextNode('#')
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    var editor = getEditor()
    if (editor) notifyMarkdownEdit(editor, nativeMarkdownValue(editor))
    return true
  }

  function commitPreviewRuleOnBlur(editor) {
    if (state.mode !== 'preview' || !editor || previewFrontMatterEdit) return false
    var paragraph = previewEditableParagraph()
    if (!paragraph) return false
    var token = paragraph.textContent.trim()
    if (!/^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(token)) return false
    var source = nativeMarkdownValue(editor)
    var entries = horizontalRuleSourceEntries(source)
    if (!entries.some(function (entry) { return entry.token === token })) return false
    editor.setValue(source, false)
    setMarkdownBridgeSource(editor, source)
    return true
  }

  function protectSplitDashInput(event) {
    if (state.mode !== 'split' || !event || event.type !== 'input') return false
    var editor = getEditor()
    var internal = editor && editor.vditor
    var source = internal && internal.sv && internal.sv.element
    if (!editor || !internal || !source) return false
    var raw = normalizedMarkdownText(source.textContent || '')
    var stable = previewStableMarkdown || state.documentText || ''
    var complete = frontMatterRange(raw)
    var hasDashBoundary = /(^|\n)---[ \t]*(?:\n|$)/.test(raw) || /(^|\n)--\n-[ \t]*(?:\n|$)/.test(raw)
    if (complete || !hasDashBoundary) return false
    event.stopPropagation()
    var leading = leadingMarkdownPrefix(stable)
    var next = leading && raw.indexOf(leading) !== 0 ? leading + raw : raw
    notifyMarkdownEdit(editor, next)
    return true
  }
  // Vditor keeps its own key/input handlers on the contenteditable root. While
  // a thematic break is temporarily represented by a paragraph, capture its
  // events here so Enter/Escape are deterministic and ordinary typing is not
  // re-parsed by Vditor before the outer click commits the value.
  document.addEventListener('keydown', function (event) {
    if (handlePendingFrontMatterKeydown(event)) return
    if (handleHeadingStartEnter(event)) return
    if (yamlMarkerOwnsEvent(event)) {
      event.stopPropagation()
      if (event.key === 'Enter') {
        event.preventDefault()
        commitYamlMarkerEdit()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        yamlMarkerEdit.source = yamlMarkerEdit.initialSource
        commitYamlMarkerEdit()
      }
      return
    }
    if (!horizontalRuleEditOwnsEvent(event)) return
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      restoreHorizontalRuleEdit()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commitHorizontalRuleEdit(true)
    }
  }, true)
  document.addEventListener('keyup', function (event) {
    if (previewFrontMatterEdit && state.mode === 'preview') event.stopPropagation()
  }, true)
  document.addEventListener('beforeinput', function (event) {
    if (event.inputType === 'insertFromPaste' && handleTrailingHashPaste(event)) return
    if (horizontalRuleEditOwnsEvent(event)) {
      event.stopPropagation()
      return
    }
    // The first dash after a soft break needs a real block of its own, so
    // reshape the source first and let the dash land on the new line.
    if (state.mode !== 'preview') return
    if (event.inputType !== 'insertText' || event.data !== '-') return
    var surface = document.querySelector('.vditor-ir')
    if (!surface || !surface.contains(event.target)) return
    if (promoteTrailingSoftBreakForRule()) event.preventDefault()
  }, true)
  document.addEventListener('paste', function (event) {
    if (handleTrailingHashPaste(event)) return
  }, true)
  document.addEventListener('input', function (event) {
    if (handleYamlMarkerInput(event)) return
    if (handleIncompleteFrontMatterInput(event)) return
    if (protectSplitDashInput(event)) return
    if (!horizontalRuleEditOwnsEvent(event)) return
    event.stopPropagation()
  }, true)
  document.addEventListener('mousedown', function (event) {
    var target = event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    var node = target && target.closest && target.closest('.vditor-ir div[data-type="yaml-front-matter"], .vditor-sv [data-type="yaml-front-matter-open-marker"], .vditor-sv [data-type="yaml-front-matter-close-marker"], .eyan-yaml-marker-input')
    var marker = yamlMarkerForTarget(target)
    if (!marker && state.mode === 'split' && state.mode !== 'readonly') {
      var splitMarker = splitYamlMarkerAtPointer(event)
      if (splitMarker) {
        event.preventDefault()
        event.stopPropagation()
        beginYamlMarkerEdit(splitMarker.node, splitMarker.marker, event, splitMarker)
        return
      }
    }
    if (marker && state.mode !== 'readonly') {
      var markerNode = marker.closest('.vditor-ir div[data-type="yaml-front-matter"], .vditor-sv [data-block]')
      if (yamlMarkerEdit && yamlMarkerEdit.input === marker) return
      event.preventDefault()
      event.stopPropagation()
      beginYamlMarkerEdit(markerNode, marker, event)
      return
    }
    if (yamlMarkerEdit && (!node || !yamlMarkerEdit.node || !yamlMarkerEdit.node.contains(target))) commitYamlMarkerEdit()
    if (state.mode !== 'preview') return
    var renderedRuleTarget = target && target.closest && target.closest('.vditor-ir .vditor-reset hr')
    if (previewFrontMatterEdit) {
      var openingParagraph = incompleteFrontMatterParagraph()
      if (!openingParagraph || !target || !openingParagraph.contains(target)) {
        var pendingEditor = getEditor()
        if (pendingEditor) commitPendingFrontMatter(pendingEditor)
      }
    } else if (!renderedRuleTarget && !(horizontalRuleEdit && horizontalRuleEdit.editor && horizontalRuleEdit.editor.contains(target))) {
      commitPreviewRuleOnBlur(getEditor())
    }
    node = target && target.closest && target.closest('.vditor-ir div[data-type="yaml-front-matter"]')
    if (!node || state.mode === 'readonly') return
    event.preventDefault()
    event.stopPropagation()
    node.classList.add('eyan-yaml-editing')
    node.dataset.eyanYamlPointerHandled = '1'
    placeYamlCaret(node, event)
    positionYamlOverlays(false)
    schedulePreviewYamlSyntax()
  }, true)
  document.addEventListener('mousedown', function (event) {
    var target = event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    var rule = horizontalRuleAtPointer(event)
    if (state.mode === 'preview' && rule) {
      // Take ownership before Vditor places its native caret. This makes a
      // single click enter the temporary source editor instead of flashing a
      // caret beside the rendered rule first.
      event.preventDefault()
      event.stopPropagation()
      beginHorizontalRuleEdit(rule)
      return
    }
    if (!horizontalRuleEdit) return
    if (target && horizontalRuleEdit.editor && horizontalRuleEdit.editor.contains(target)) return
    commitHorizontalRuleEdit(false)
  }, true)
  document.addEventListener('click', function (event) {
    if (state.mode !== 'preview') return
    var target = event.target && (event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement)
    var rule = target && target.closest && target.closest('.vditor-ir .vditor-reset hr')
    if (!rule) return
    event.preventDefault()
    event.stopPropagation()
    beginHorizontalRuleEdit(rule)
  }, true)
  document.addEventListener('mouseover', handleLinkMouseOver, true)
  document.addEventListener('mouseout', handleLinkMouseOut, true)
  document.addEventListener('click', handleReadonlyInteractionClick, true)
  document.addEventListener('click', handleRenderedLinkClick, true)
  document.addEventListener('scroll', hideLinkTooltip, true)
  document.addEventListener('scroll', positionExternalLinkOverlays, true)
  document.addEventListener('scroll', scheduleHeadingFoldPosition, true)
  document.addEventListener('scroll', handleSplitScrollEvent, true)
  document.addEventListener('selectionchange', function () {
    scheduleSplitActiveLineNumber()
    scheduleSplitSameTextHighlights()
    scheduleActiveSelection()
  })
  document.addEventListener('input', function (event) {
    if (state.mode === 'preview') schedulePreviewYamlSyntax()
    if (state.mode === 'preview' && !previewFrontMatterEdit) {
      setTimeout(function () {
        var editor = getEditor()
        if (!editor) return
        var source = nativeMarkdownValue(editor)
        previewStableMarkdown = source
        state.documentText = source
      }, 0)
    }
    var source = document.querySelector('.vditor-sv')
    if (!source || !source.contains(event.target)) return
    lastSplitInputAt = Date.now()
    // Vditor emits a synthetic input while rebuilding the SV surface during a
    // mode switch. Keep the pre-switch token snapshot for that internal event;
    // only a trusted user edit is allowed to replace `***`/`___`/long dashes.
    if (event.isTrusted !== false || !splitHorizontalRuleEntries || !splitHorizontalRuleEntries.some(function (entry) {
      return entry && entry.token && entry.token !== '---'
    })) {
      splitHorizontalRuleEntries = horizontalRuleSourceEntries(source.textContent)
    }
    // Capture phase, so the pane still holds the typed text. Vditor's own
    // re-render is debounced and runs later, which is when Lute would pad any
    // setext underline here.
    splitSetextRuns = splitDashRuns(source.textContent)
    lockSplitPreviewDuringInput(source)
    scheduleSplitHorizontalRuleRestore()
    // Run after Vditor commits the edited text so the active line never falls
    // back to its uncoloured base text during the normal debounce window.
    scheduleSplitSourceTools(true)
  }, true)
  // Explicit user intent on the preview cancels the post-input lock, so the
  // restore never fights a deliberate wheel or scrollbar drag.
  function dropSplitInputScrollLock(event) {
    if (!splitInputScrollLock) return
    var preview = document.querySelector('.vditor-preview')
    if (preview && (event.target === preview || preview.contains(event.target))) splitInputScrollLock = null
  }
  document.addEventListener('wheel', dropSplitInputScrollLock, { passive: true, capture: true })
  document.addEventListener('pointerdown', dropSplitInputScrollLock, true)
  document.addEventListener('scroll', function () { positionYamlOverlays(false) }, true)
  window.addEventListener('resize', function () {
    hideLinkTooltip()
    positionExternalLinkOverlays()
    positionYamlOverlays(false)
    scheduleHeadingFoldPosition()
    scheduleRenderedChartResize()
    scheduleSplitLineNumbers()
  })
  document.addEventListener('compositionstart', function (event) {
    if (state.mode === 'preview') previewYamlComposing = true
    var source = document.querySelector('.vditor-sv')
    if (source && source.contains(event.target)) splitSourceComposing = true
  }, true)
  document.addEventListener('compositionend', function (event) {
    if (previewYamlComposing) {
      previewYamlComposing = false
      schedulePreviewYamlSyntax()
    }
    var source = document.querySelector('.vditor-sv')
    if (source && source.contains(event.target)) {
      splitSourceComposing = false
      scheduleSplitSourceTools(true)
    }
  }, true)
  document.addEventListener('mousedown', function (event) {
    var editing = document.querySelector('.vditor-ir div[data-type="yaml-front-matter"].eyan-yaml-editing')
    var targetType = event.target && event.target.getAttribute && event.target.getAttribute('data-type')
    if (yamlMarkerEdit && (event.target === yamlMarkerEdit.marker || event.target === yamlMarkerEdit.input || (yamlMarkerEdit.node && yamlMarkerEdit.node.contains(event.target)) || targetType === 'yaml-front-matter-open-marker' || targetType === 'yaml-front-matter-close-marker')) return
    if (editing && !editing.contains(event.target)) {
      editing.classList.remove('eyan-yaml-editing')
      positionYamlOverlays()
      schedulePreviewYamlSyntax()
    }
  }, true)
  // Esc leaves any Preview Edit editing state. Innermost first, and only the
  // state that actually matched is consumed, so the existing Esc handlers for
  // the rule editor, Mermaid label and table selection keep their own
  // behaviour untouched.
  function exitYamlEditingOnEscape() {
    var editing = document.querySelector('.vditor-ir div[data-type="yaml-front-matter"].eyan-yaml-editing')
    if (!editing) return false
    editing.classList.remove('eyan-yaml-editing')
    positionYamlOverlays()
    schedulePreviewYamlSyntax()
    var selection = window.getSelection()
    if (selection) selection.removeAllRanges()
    var surface = document.querySelector('.vditor-ir')
    if (surface && typeof surface.focus === 'function') surface.focus({ preventScroll: true })
    return true
  }
  function collapseExpandedNodeOnEscape() {
    var selection = window.getSelection()
    var anchor = selection && selection.anchorNode
    var element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)
    var node = element && element.closest && element.closest('.vditor-ir .vditor-ir__node--expand')
    if (!node) return false
    node.classList.remove('vditor-ir__node--expand')
    if (selection) selection.removeAllRanges()
    var surface = document.querySelector('.vditor-ir')
    if (surface && typeof surface.focus === 'function') surface.focus({ preventScroll: true })
    return true
  }
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || state.mode !== 'preview') return
    if (horizontalRuleEdit) return
    if (exitYamlEditingOnEscape() || collapseExpandedNodeOnEscape()) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, true)
  function mutationsAreTableContentOnly(records) {
    var foundTableContent = false
    for (var recordIndex = 0; recordIndex < records.length; recordIndex++) {
      var record = records[recordIndex]
      var targetElement = record.target && (record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement)
      var table = targetElement && targetElement.closest && targetElement.closest('table.eyan-layout-table')
      if (!table) return false
      foundTableContent = true
      if (record.type !== 'childList') continue
      var changedNodes = Array.from(record.addedNodes || []).concat(Array.from(record.removedNodes || []))
      var structural = changedNodes.some(function (node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false
        return node.matches('table, thead, tbody, tr, th, td') || !!node.querySelector('table, thead, tbody, tr, th, td')
      })
      if (structural) return false
    }
    return foundTableContent
  }
  new MutationObserver(function (records) {
    if (state.mode === 'preview') schedulePreviewYamlSyntax()
    // Undo Lute's setext padding as soon as it lands, before the source tools
    // index the pane, so the rest of this pass sees the author's own text.
    if (normalizeSplitSetextUnderlines()) scheduleSplitSourceTools(true)
    restoreSplitPreviewAfterInput(records)
    if (mutationsAreTableContentOnly(records)) {
      enhanceInlineTableBreaks()
      if (tableRangeSelection) paintTableRangeSelection()
      scheduleStickyTableHeader()
      scheduleTableSelectorLayer()
      return
    }
    reconcilePendingTableStructure()
    applyKnownTableLayoutsBeforePaint()
    scheduleTableLayoutRefresh()
    scheduleEnhance()
  }).observe(document.getElementById('app'), {
    childList: true,
    subtree: true,
    characterData: true
  })
  new MutationObserver(function () {
    if (document.body.getAttribute('data-vmd-ready') === '1') scheduleEnhance()
  }).observe(document.body, { attributes: true, attributeFilter: ['data-vmd-ready'] })
  ensureFindReplaceController()
})()
