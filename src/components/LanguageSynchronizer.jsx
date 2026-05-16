import { useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { translateText } from '../i18n/translations'

const textSourceMap = new WeakMap()
const attrSourceMap = new WeakMap()

function translateWithWhitespace(value, language) {
  const leadingWhitespace = value.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = value.match(/\s*$/)?.[0] ?? ''
  const coreValue = value.trim()

  if (!coreValue) {
    return value
  }

  return `${leadingWhitespace}${translateText(coreValue, language)}${trailingWhitespace}`
}

function shouldSkipTextNode(node) {
  const parentTag = node.parentElement?.tagName
  return ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parentTag) || node.parentElement?.closest('[data-no-translate="true"]')
}

function processTextNode(node, language) {
  if (!node.nodeValue || shouldSkipTextNode(node)) {
    return
  }

  const currentSource = textSourceMap.get(node)
  const currentRenderedValue = currentSource ? translateWithWhitespace(currentSource, language) : null

  if (!currentSource || (node.nodeValue !== currentRenderedValue && node.nodeValue.trim() !== currentRenderedValue?.trim())) {
    textSourceMap.set(node, node.nodeValue)
  }

  const sourceValue = textSourceMap.get(node)
  const translatedValue = translateWithWhitespace(sourceValue, language)

  if (translatedValue !== node.nodeValue) {
    node.nodeValue = translatedValue
  }
}

function processAttribute(element, attributeName, language) {
  const value = element.getAttribute(attributeName)

  if (!value) {
    return
  }

  const elementAttributeSources = attrSourceMap.get(element) ?? {}
  const currentSource = elementAttributeSources[attributeName]
  const currentRenderedValue = currentSource ? translateText(currentSource, language) : null

  if (!currentSource || (value !== currentRenderedValue && value.trim() !== currentRenderedValue?.trim())) {
    elementAttributeSources[attributeName] = value
    attrSourceMap.set(element, elementAttributeSources)
  }

  const sourceValue = attrSourceMap.get(element)?.[attributeName]
  const translatedValue = translateText(sourceValue, language)

  if (translatedValue !== value) {
    element.setAttribute(attributeName, translatedValue)
  }
}

function processNode(node, language) {
  if (node.nodeType === Node.TEXT_NODE) {
    processTextNode(node, language)
    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return
  }

  if (node.closest?.('[data-no-translate="true"]')) {
    return
  }

  ;['placeholder', 'title', 'aria-label'].forEach((attributeName) => processAttribute(node, attributeName, language))

  node.childNodes.forEach((childNode) => processNode(childNode, language))
}

function translateDocument(language) {
  const rootNode = document.getElementById('root')

  if (!rootNode) {
    return
  }

  processNode(rootNode, language)
}

function LanguageSynchronizer() {
  const { language } = useLanguage()

  useEffect(() => {
    translateDocument(language)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          processTextNode(mutation.target, language)
          return
        }

        if (mutation.type === 'attributes') {
          processAttribute(mutation.target, mutation.attributeName, language)
          return
        }

        mutation.addedNodes.forEach((node) => processNode(node, language))
      })
    })

    const rootNode = document.getElementById('root')

    if (rootNode) {
      observer.observe(rootNode, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'aria-label'],
      })
    }

    return () => observer.disconnect()
  }, [language])

  return null
}

export default LanguageSynchronizer
