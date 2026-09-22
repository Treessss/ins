(() => {
  const optionInputSelector = "input[data-option-position][data-option-name][data-option-label]";
  const deviceGroupSelector = "[data-required-device-option-group]";
  const deviceOptionSelector = "[data-required-device-option]";
  const deviceNamePattern = /(device|phone|model|iphone|手机|手機|机型|機型|型号|型號|设备|設備)/i;
  const caseTypeNamePattern = /(case\s*type|case|type|style|壳型|殼型|手机壳|手機殼|保护壳|保護殼|款式)/i;
  const baseColorNamePattern = /(base\s*color|base|color|colour|底色|颜色|顏色|色)/i;

  function isCustomizeMode() {
    return new URL(window.location.href).searchParams.get("customize") === "1";
  }

  function syncCustomizeModeClass() {
    document.documentElement.classList.toggle("custom-case-customizing", isCustomizeMode());
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getForm(formId) {
    return formId ? document.forms[formId] || document.getElementById(formId) : null;
  }

  function getOptionInputs(formId, form = getForm(formId)) {
    const inputs = new Set();

    if (form) {
      Array.from(form.elements || []).forEach((element) => {
        if (element.matches?.(optionInputSelector)) {
          inputs.add(element);
        }
      });
    }

    if (formId) {
      document.querySelectorAll(`${optionInputSelector}[form="${CSS.escape(formId)}"]`).forEach((input) => inputs.add(input));
    }

    return Array.from(inputs);
  }

  function getSelectedOptions(formId, form = getForm(formId)) {
    return getOptionInputs(formId, form).filter((input) => input.checked).map((input) => ({
      name: input.dataset.optionName || "",
      label: input.dataset.optionLabel || "",
      value: input.value || "",
      position: input.dataset.optionPosition || ""
    })).filter((option) => option.name && option.label);
  }

  function getNamedOption(selectedOptions, pattern) {
    return selectedOptions.find((option) => pattern.test(option.name)) || null;
  }

  function getRequiredDeviceGroups(formId) {
    if (!formId) {
      return [];
    }

    return Array.from(document.querySelectorAll(`${deviceGroupSelector}[data-form-id="${CSS.escape(formId)}"]`));
  }

  function getSelectedRequiredDeviceInput(form, group) {
    const position = group?.dataset.requiredDeviceOptionPosition || "";
    const saved = position && form?.dataset?.[`requiredDeviceSelected${position}`] === "true";

    if (!saved && group?.dataset.requiredDeviceSelected !== "true") {
      return null;
    }

    return getOptionInputs(form?.id || "", form).find((input) => {
      return input.matches?.(deviceOptionSelector) && input.dataset.optionPosition === position && input.checked;
    }) || null;
  }

  function activateRequiredDeviceInput(input) {
    const form = input.form;
    const position = input.dataset.optionPosition || "";
    const group = form?.id ? getRequiredDeviceGroups(form.id).find((item) => item.dataset.requiredDeviceOptionPosition === position) : null;

    if (group) {
      group.dataset.requiredDeviceSelected = "true";
    }

    if (form && position) {
      form.dataset[`requiredDeviceSelected${position}`] = "true";
      form.dataset[`requiredDevicePosition${position}`] = input.value || "";
    }
  }

  function requiredSelectionsAreComplete(formId) {
    const form = getForm(formId);

    if (!form) {
      return true;
    }

    const deviceGroups = getRequiredDeviceGroups(formId);

    for (const group of deviceGroups) {
      if (!getSelectedRequiredDeviceInput(form, group)) {
        group.classList.add("variant-picker__option--missing-required");
        return false;
      }
    }

    const inputs = getOptionInputs(formId, form);
    const hasCaseTypeOption = inputs.some((input) => caseTypeNamePattern.test(input.dataset.optionName || ""));
    const hasSelectedCaseType = getSelectedOptions(formId, form).some((option) => caseTypeNamePattern.test(option.name));

    return !hasCaseTypeOption || hasSelectedCaseType;
  }

  function findLaunchForm(button) {
    const formId = button?.dataset?.customCaseFormId || button?.closest("buy-buttons")?.getAttribute("form") || button?.closest("product-quick-add")?.getAttribute("form") || button?.getAttribute("form") || "";
    return getForm(formId) || button?.form || document.querySelector('form[is="product-form"]');
  }

  function focusFirstMissingSelection(formId) {
    const missingGroup = getRequiredDeviceGroups(formId).find((group) => group.classList.contains("variant-picker__option--missing-required")) || getRequiredDeviceGroups(formId)[0];

    if (!missingGroup) {
      return;
    }

    missingGroup.scrollIntoView({ block: "center", behavior: "smooth" });
    missingGroup.querySelector("button, input, select, [tabindex]")?.focus?.();
  }

  function buildCustomizeUrl(productUrl, variantId) {
    const url = new URL(productUrl || window.location.href, window.location.origin);
    url.searchParams.set("customize", "1");

    if (variantId) {
      url.searchParams.set("variant", variantId);
    }

    return url;
  }

  function buildProductUrl(productUrl) {
    const url = new URL(productUrl || window.location.href, window.location.origin);
    url.searchParams.delete("customize");
    return url;
  }

  function setButtonContent(button, label) {
    const content = button.querySelector(".button__content");

    if (content) {
      content.textContent = label;
    } else {
      button.textContent = label;
    }

    button.dataset.buttonLabel = label;
  }

  function loadPreviewMap(mapId) {
    if (!mapId) {
      return [];
    }

    const script = document.getElementById(mapId);

    if (!script) {
      return [];
    }

    try {
      const parsed = JSON.parse(script.textContent || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function entryMatches(entry, selectedOptions) {
    const checks = [
      [entry.option1Name, entry.option1Value],
      [entry.option2Name, entry.option2Value]
    ].filter(([name, value]) => normalize(name) && normalize(value));

    if (checks.length === 0 || !entry.image) {
      return false;
    }

    return checks.every(([name, value]) => {
      return selectedOptions.some((option) => normalize(option.name) === normalize(name) && normalize(option.label) === normalize(value));
    });
  }

  function resolvePreviewBase({ map, selectedOptions, defaultImage, defaultLabel }) {
    const exactTwoOptionMatch = map.find((entry) => {
      const configuredCount = [
        [entry.option1Name, entry.option1Value],
        [entry.option2Name, entry.option2Value]
      ].filter(([name, value]) => normalize(name) && normalize(value)).length;

      return configuredCount >= 2 && entryMatches(entry, selectedOptions);
    });
    const anyMatch = exactTwoOptionMatch || map.find((entry) => entryMatches(entry, selectedOptions));

    return {
      image: anyMatch?.image || defaultImage || "",
      label: anyMatch?.label || defaultLabel || ""
    };
  }

  function renderSelectedSummary(container, selectedOptions) {
    if (!container) {
      return;
    }

    const importantOptions = selectedOptions.filter((option) => {
      return deviceNamePattern.test(option.name) || caseTypeNamePattern.test(option.name);
    });
    const optionsToRender = importantOptions.length ? importantOptions : selectedOptions.slice(0, 3);

    if (optionsToRender.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = optionsToRender.map((option) => {
      return `<div class="custom-case-selected__row"><span class="custom-case-selected__label">${escapeHtml(option.name)}</span><strong>${escapeHtml(option.label)}</strong></div>`;
    }).join("");
  }

  function renderStepSummaries(root, selectedOptions) {
    if (!root) {
      return;
    }

    const deviceOption = getNamedOption(selectedOptions, deviceNamePattern);
    const caseTypeOption = getNamedOption(selectedOptions, caseTypeNamePattern);
    const baseColorOption = getNamedOption(selectedOptions, baseColorNamePattern);
    const summaries = {
      device: deviceOption?.label || "Select phone model",
      "case-type": caseTypeOption?.label || "Select case type",
      "base-color": baseColorOption?.label || "Default"
    };

    Object.entries(summaries).forEach(([name, value]) => {
      root.querySelectorAll(`[data-case-step-summary="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function decorateProductPageLaunchButtons() {
    const flow = document.querySelector("custom-case-flow[data-product-url]");

    if (!flow) {
      return;
    }

    const productUrl = flow.dataset.productUrl || window.location.pathname;
    const buttons = new Set();
    document.querySelectorAll('buy-buttons[template="custom-phone-case"] [data-atc-button]').forEach((button) => buttons.add(button));
    document.querySelectorAll("product-quick-add [data-atc-button]").forEach((button) => buttons.add(button));

    buttons.forEach((button) => {
      if (button.closest(".shopify-section--case-customizer-product")) {
        return;
      }

      button.setAttribute("data-custom-case-launch", "");
      button.dataset.customCaseProductUrl = productUrl;
      setButtonContent(button, "Customize Now");
      button.removeAttribute("aria-controls");
      button.removeAttribute("aria-expanded");
    });
  }

  function decorateCustomizerBuyButtons() {
    document.querySelectorAll(".shopify-section--case-customizer-product .custom-case-page__buy-buttons [data-atc-button]").forEach((button) => {
      setButtonContent(button, "Add to cart");
      button.removeAttribute("data-custom-case-launch");
    });
  }

  syncCustomizeModeClass();
  window.addEventListener("popstate", syncCustomizeModeClass);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      decorateProductPageLaunchButtons();
      decorateCustomizerBuyButtons();
    }, { once: true });
  } else {
    decorateProductPageLaunchButtons();
    decorateCustomizerBuyButtons();
  }

  document.addEventListener("product:rerender", () => {
    requestAnimationFrame(() => {
      decorateProductPageLaunchButtons();
      decorateCustomizerBuyButtons();
    });
  });

  document.addEventListener("click", (event) => {
    const launchButton = event.target.closest?.("[data-custom-case-launch]");

    if (launchButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (launchButton.hasAttribute("disabled") || launchButton.getAttribute("aria-disabled") === "true") {
        return;
      }

      const form = findLaunchForm(launchButton);
      const formId = form?.id || launchButton.dataset.customCaseFormId || "";

      if (!requiredSelectionsAreComplete(formId)) {
        focusFirstMissingSelection(formId);
        return;
      }

      const variantId = form?.elements?.id?.value || form?.querySelector?.('[name="id"]')?.value || new URL(window.location.href).searchParams.get("variant") || "";
      window.location.href = buildCustomizeUrl(launchButton.dataset.customCaseProductUrl || window.location.href, variantId).toString();
      return;
    }

    const exitButton = event.target.closest?.("[data-custom-case-exit]");

    if (exitButton) {
      event.preventDefault();
      const flow = exitButton.closest("custom-case-flow");
      window.location.href = buildProductUrl(flow?.dataset?.productUrl || window.location.href).toString();
    }
  }, true);

  if (!window.customElements.get("custom-case-flow")) {
    class CustomCaseFlow extends HTMLElement {
      connectedCallback() {
        this.formId = this.dataset.formId || "";
        this.form = getForm(this.formId);
        this.previewMap = loadPreviewMap(this.dataset.previewMapId);
        this.defaultBaseImage = this.dataset.defaultBaseImage || "";
        this.defaultBaseLabel = this.dataset.defaultBaseLabel || "";
        this.onClick = this.handleClick.bind(this);
        this.onChange = this.handleChange.bind(this);
        this.onRerender = this.handleRerender.bind(this);
        this.onPopState = this.syncViewFromUrl.bind(this);

        this.addEventListener("click", this.onClick);
        document.addEventListener("change", this.onChange, true);
        this.form?.addEventListener("variant:change", this.onRerender);
        this.form?.addEventListener("product:rerender", this.onRerender);
        window.addEventListener("popstate", this.onPopState);

        this.syncViewFromUrl();
        this.updateUi();
      }

      disconnectedCallback() {
        this.removeEventListener("click", this.onClick);
        document.removeEventListener("change", this.onChange, true);
        this.form?.removeEventListener("variant:change", this.onRerender);
        this.form?.removeEventListener("product:rerender", this.onRerender);
        window.removeEventListener("popstate", this.onPopState);
      }

      handleClick(event) {
        const continueButton = event.target.closest("[data-custom-case-continue]");
        const backButton = event.target.closest("[data-custom-case-back]");

        if (continueButton && this.contains(continueButton)) {
          event.preventDefault();
          this.continueToCustomizer();
        }

        if (backButton && this.contains(backButton)) {
          event.preventDefault();
          this.goBackToConfigure();
        }
      }

      handleChange(event) {
        if (!event.target.matches?.(optionInputSelector) || event.target.getAttribute("form") !== this.formId) {
          return;
        }

        if (event.target.matches(deviceOptionSelector)) {
          activateRequiredDeviceInput(event.target);
        }

        this.classList.remove("has-selection-error");
        requestAnimationFrame(() => this.updateUi());
      }

      handleRerender() {
        requestAnimationFrame(() => {
          this.form = getForm(this.formId);
          this.syncViewFromUrl();
          this.updateUi();
        });
      }

      continueToCustomizer() {
        if (!requiredSelectionsAreComplete(this.formId)) {
          this.classList.add("has-selection-error");
          this.querySelector("[data-custom-case-error]")?.focus?.();
          return;
        }

        this.classList.remove("has-selection-error");
        const variantId = this.form?.elements?.id?.value || "";
        window.location.href = buildCustomizeUrl(this.dataset.productUrl || window.location.href, variantId).toString();
      }

      goBackToConfigure() {
        window.location.href = buildProductUrl(this.dataset.productUrl || window.location.href).toString();
      }

      syncViewFromUrl() {
        syncCustomizeModeClass();

        if (isCustomizeMode()) {
          this.showCustomizeView({ keepScroll: true });
        } else {
          this.showConfigureView({ keepScroll: true });
        }
      }

      showConfigureView(options = {}) {
        this.classList.add("is-configuring");
        this.classList.remove("is-customizing");

        if (!options.keepScroll) {
          this.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      }

      showCustomizeView(options = {}) {
        this.classList.add("is-customizing");
        this.classList.remove("is-configuring");

        if (!options.keepScroll) {
          this.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      }

      updateUi() {
        const selectedOptions = getSelectedOptions(this.formId, this.form);
        const base = resolvePreviewBase({
          map: this.previewMap,
          selectedOptions,
          defaultImage: this.defaultBaseImage,
          defaultLabel: this.defaultBaseLabel
        });

        this.updatePreview(base);
        renderStepSummaries(this, selectedOptions);
        this.querySelectorAll("[data-custom-case-selected-summary]").forEach((container) => renderSelectedSummary(container, selectedOptions));
      }

      updatePreview(base) {
        const preview = this.querySelector("[data-custom-case-preview]");
        const image = this.querySelector("[data-custom-case-preview-image]");

        if (!preview || !image) {
          return;
        }

        if (base.image) {
          image.hidden = false;
          image.src = base.image;
          image.alt = base.label || image.alt || "";
          preview.classList.add("has-image");
        } else {
          image.hidden = true;
          image.removeAttribute("src");
          preview.classList.remove("has-image");
        }
      }
    }

    window.customElements.define("custom-case-flow", CustomCaseFlow);
  }

  if (window.customElements.get("case-customizer")) {
    return;
  }

  class CaseCustomizer extends HTMLElement {
    connectedCallback() {
      this.canvas = this.querySelector("[data-case-canvas]");
      this.ctx = this.canvas?.getContext("2d");
      this.fileInput = this.querySelector("[data-case-file]");
      this.uploadButton = this.querySelector(".case-customizer__upload-button");
      this.fileName = this.querySelector("[data-case-file-name]");
      this.quality = this.querySelector("[data-case-quality]");
      this.status = this.querySelector("[data-case-status]");
      this.selectionSummary = this.querySelector("[data-case-selected-options]");
      this.zoomInput = this.querySelector("[data-case-zoom]");
      this.rotateInput = this.querySelector("[data-case-rotate]");
      this.textInput = this.querySelector("[data-case-text]");
      this.textColorInputs = Array.from(this.querySelectorAll("[data-case-text-color]"));
      this.stickerButtons = Array.from(this.querySelectorAll("[data-case-sticker]"));
      this.stepCards = Array.from(this.querySelectorAll("[data-case-step-card]"));
      this.stepTriggers = Array.from(this.querySelectorAll("[data-case-step-trigger]"));
      this.prevStepButton = this.querySelector("[data-case-step-prev]");
      this.nextStepButton = this.querySelector("[data-case-step-next]");
      this.stepProgress = this.querySelector("[data-case-step-progress]");
      this.form = getForm(this.dataset.formId || "");
      this.fields = {
        status: this.querySelector('[data-case-property="status"]'),
        device: this.querySelector('[data-case-property="device"]'),
        caseType: this.querySelector('[data-case-property="caseType"]'),
        selectedOptions: this.querySelector('[data-case-property="selectedOptions"]'),
        base: this.querySelector('[data-case-property="base"]'),
        placement: this.querySelector('[data-case-property="placement"]'),
        text: this.querySelector('[data-case-property="text"]'),
        sticker: this.querySelector('[data-case-property="sticker"]'),
        payload: this.querySelector('[data-case-property="payload"]'),
        upload: this.querySelector('[data-case-property="upload"]')
      };
      this.required = this.dataset.required === "true";
      this.recommendedWidth = Number(this.dataset.recommendedWidth || 1800);
      this.recommendedHeight = Number(this.dataset.recommendedHeight || 2600);
      this.uploadEndpoint = (this.dataset.uploadEndpoint || "").trim();
      this.previewMap = loadPreviewMap(this.dataset.previewMapId);
      this.defaultBaseImage = this.dataset.defaultBaseImage || "";
      this.defaultBaseLabel = this.dataset.defaultBaseLabel || "";
      this.baseImageUrl = "";
      this.baseLabel = "";
      this.baseImage = null;
      this.objectUrl = "";
      this.image = null;
      this.file = null;
      this.uploadUrl = "";
      this.drag = null;
      this.state = {
        baseScale: 1,
        zoom: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        text: "",
        textColor: "#111111",
        sticker: ""
      };

      if (!this.canvas || !this.ctx || !this.fileInput) {
        return;
      }

      if (this.form) {
        this.form.enctype = "multipart/form-data";
      }

      this.onFileChange = this.handleFileChange.bind(this);
      this.onPointerDown = this.handlePointerDown.bind(this);
      this.onPointerMove = this.handlePointerMove.bind(this);
      this.onPointerUp = this.handlePointerUp.bind(this);
      this.onWheel = this.handleWheel.bind(this);
      this.onSubmit = this.handleSubmit.bind(this);
      this.onInvalid = this.handleInvalid.bind(this);
      this.onVariantChange = this.syncSelectionAndBase.bind(this);
      this.onOptionChange = this.handleOptionChange.bind(this);
      this.onStepTriggerClick = this.handleStepTriggerClick.bind(this);
      this.onStepPrevClick = this.handleStepPrevClick.bind(this);
      this.onStepNextClick = this.handleStepNextClick.bind(this);
      this.onUploadButtonKeydown = this.handleUploadButtonKeydown.bind(this);

      this.fileInput.addEventListener("change", this.onFileChange);
      this.fileInput.addEventListener("invalid", this.onInvalid);
      this.uploadButton?.addEventListener("keydown", this.onUploadButtonKeydown);
      this.canvas.addEventListener("pointerdown", this.onPointerDown);
      this.canvas.addEventListener("pointermove", this.onPointerMove);
      this.canvas.addEventListener("pointerup", this.onPointerUp);
      this.canvas.addEventListener("pointercancel", this.onPointerUp);
      this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
      this.zoomInput?.addEventListener("input", () => {
        this.state.zoom = Number(this.zoomInput.value || 100) / 100;
        this.render();
      });
      this.rotateInput?.addEventListener("input", () => {
        this.state.rotation = Number(this.rotateInput.value || 0);
        this.render();
      });
      this.textInput?.addEventListener("input", () => {
        this.state.text = this.textInput.value.trim();
        this.render();
      });
      this.textColorInputs.forEach((input) => {
        input.addEventListener("change", () => {
          if (input.checked) {
            this.state.textColor = input.value || "#111111";
            this.render();
          }
        });
      });
      this.stickerButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.setSticker(button.dataset.caseSticker || "");
        });
      });
      this.querySelector("[data-case-fit]")?.addEventListener("click", () => this.fitArtwork("fit"));
      this.querySelector("[data-case-fill]")?.addEventListener("click", () => this.fitArtwork("fill"));
      this.querySelector("[data-case-center]")?.addEventListener("click", () => {
        this.state.offsetX = 0;
        this.state.offsetY = 0;
        this.render();
      });
      this.querySelector("[data-case-reset]")?.addEventListener("click", () => this.resetArtwork());
      this.form?.addEventListener("submit", this.onSubmit, true);
      this.form?.addEventListener("variant:change", this.onVariantChange);
      this.form?.addEventListener("product:rerender", this.onVariantChange);
      document.addEventListener("change", this.onOptionChange, true);
      this.stepTriggers.forEach((trigger) => trigger.addEventListener("click", this.onStepTriggerClick));
      this.prevStepButton?.addEventListener("click", this.onStepPrevClick);
      this.nextStepButton?.addEventListener("click", this.onStepNextClick);

      const initialStep = this.stepCards.findIndex((card) => card.classList.contains("is-active"));
      this.currentStepIndex = initialStep >= 0 ? initialStep : 0;
      this.setStep(this.currentStepIndex);
      this.syncSelectionAndBase();
      this.draw();
      this.updateProperties();
    }

    disconnectedCallback() {
      this.fileInput?.removeEventListener("change", this.onFileChange);
      this.fileInput?.removeEventListener("invalid", this.onInvalid);
      this.uploadButton?.removeEventListener("keydown", this.onUploadButtonKeydown);
      this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas?.removeEventListener("pointermove", this.onPointerMove);
      this.canvas?.removeEventListener("pointerup", this.onPointerUp);
      this.canvas?.removeEventListener("pointercancel", this.onPointerUp);
      this.canvas?.removeEventListener("wheel", this.onWheel);
      this.form?.removeEventListener("submit", this.onSubmit, true);
      this.form?.removeEventListener("variant:change", this.onVariantChange);
      this.form?.removeEventListener("product:rerender", this.onVariantChange);
      document.removeEventListener("change", this.onOptionChange, true);
      this.stepTriggers?.forEach((trigger) => trigger.removeEventListener("click", this.onStepTriggerClick));
      this.prevStepButton?.removeEventListener("click", this.onStepPrevClick);
      this.nextStepButton?.removeEventListener("click", this.onStepNextClick);
      this.revokeObjectUrl();
    }

    handleUploadButtonKeydown(event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      this.fileInput?.click();
    }

    handleStepTriggerClick(event) {
      const card = event.currentTarget.closest("[data-case-step-card]");
      const index = this.stepCards.indexOf(card);

      if (index < 0 || index === this.currentStepIndex) {
        return;
      }

      this.setStep(index, { focus: false });
    }

    handleStepPrevClick() {
      this.setStep((this.currentStepIndex || 0) - 1, { focus: true });
    }

    handleStepNextClick() {
      if (!this.canLeaveStep(this.currentStepIndex || 0, 1)) {
        return;
      }

      this.setStep((this.currentStepIndex || 0) + 1, { focus: true });
    }

    canLeaveStep(index, direction) {
      const card = this.stepCards[index];

      if (direction > 0 && card?.dataset.caseStepCard === "upload" && this.required && !this.fileInput.files?.length) {
        this.setStatus("Please upload your artwork before continuing.", "invalid");
        this.querySelector(".case-customizer__upload-button")?.focus?.();
        return false;
      }

      return true;
    }

    findStepIndex(name) {
      return this.stepCards.findIndex((card) => card.dataset.caseStepCard === name);
    }

    setStep(index, options = {}) {
      if (!this.stepCards.length) {
        return;
      }

      const clampedIndex = Math.max(0, Math.min(index, this.stepCards.length - 1));
      this.currentStepIndex = clampedIndex;

      this.stepCards.forEach((card, cardIndex) => {
        const isActive = cardIndex === clampedIndex;
        const content = card.querySelector("[data-case-step-content]");
        const trigger = card.querySelector("[data-case-step-trigger]");
        const icon = card.querySelector("[data-case-step-icon]");

        card.classList.toggle("is-active", isActive);
        card.classList.toggle("is-complete", cardIndex < clampedIndex);
        card.toggleAttribute("data-case-active-step", isActive);

        if (content) {
          content.hidden = !isActive;
        }

        if (trigger) {
          trigger.setAttribute("aria-expanded", isActive ? "true" : "false");
          if (isActive) {
            trigger.setAttribute("aria-current", "step");
          } else {
            trigger.removeAttribute("aria-current");
          }
        }

        if (icon) {
          icon.textContent = isActive ? "×" : "+";
        }
      });

      if (this.prevStepButton) {
        this.prevStepButton.disabled = clampedIndex === 0;
      }

      if (this.nextStepButton) {
        this.nextStepButton.disabled = clampedIndex === this.stepCards.length - 1;
      }

      if (this.stepProgress) {
        this.stepProgress.textContent = `${String(clampedIndex + 1).padStart(2, "0")}/${String(this.stepCards.length).padStart(2, "0")}`;
      }

      this.dataset.currentStep = String(clampedIndex + 1);

      if (options.focus) {
        const activeCard = this.stepCards[clampedIndex];
        activeCard?.querySelector("[data-case-step-trigger]")?.focus?.({ preventScroll: true });
        activeCard?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      }
    }

    setSticker(sticker) {
      this.state.sticker = sticker === "none" ? "" : sticker;
      this.stickerButtons.forEach((button) => {
        const value = button.dataset.caseSticker || "";
        button.classList.toggle("is-selected", value === sticker || (!this.state.sticker && value === "none"));
      });
      this.render();
    }

    handleOptionChange(event) {
      if (!event.target.matches?.(optionInputSelector) || event.target.getAttribute("form") !== this.dataset.formId) {
        return;
      }

      requestAnimationFrame(() => this.syncSelectionAndBase());
    }

    syncSelectionAndBase() {
      this.form = getForm(this.dataset.formId || "");
      this.selectedOptions = getSelectedOptions(this.dataset.formId || "", this.form);
      renderSelectedSummary(this.selectionSummary, this.selectedOptions);
      renderStepSummaries(this, this.selectedOptions);
      const base = resolvePreviewBase({
        map: this.previewMap,
        selectedOptions: this.selectedOptions,
        defaultImage: this.defaultBaseImage,
        defaultLabel: this.defaultBaseLabel
      });
      this.setBaseImage(base.image, base.label);
      this.updateProperties();
    }

    setBaseImage(url, label) {
      this.baseLabel = label || "";

      if (!url) {
        this.baseImageUrl = "";
        this.baseImage = null;
        this.classList.remove("has-base-image");
        this.draw();
        return;
      }

      if (url === this.baseImageUrl && this.baseImage) {
        this.draw();
        return;
      }

      this.baseImageUrl = url;
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (this.baseImageUrl !== url) {
          return;
        }

        this.baseImage = image;
        this.classList.add("has-base-image");
        this.draw();
        this.updateProperties();
      };
      image.onerror = () => {
        if (this.baseImageUrl === url) {
          this.baseImage = null;
          this.classList.remove("has-base-image");
          this.draw();
        }
      };
      image.src = url;
    }

    async handleFileChange() {
      const file = this.fileInput.files?.[0] || null;

      if (!file) {
        this.clearArtwork();
        return;
      }

      if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
        this.fileInput.value = "";
        this.fileInput.setCustomValidity("Please upload a PNG, JPG, or WEBP image.");
        this.fileInput.reportValidity();
        this.setStatus("Please upload a PNG, JPG, or WEBP image.", "invalid");
        return;
      }

      this.fileInput.setCustomValidity("");
      this.file = file;
      this.fileName.textContent = file.name;
      this.revokeObjectUrl();
      this.objectUrl = URL.createObjectURL(file);

      const image = new Image();
      image.decoding = "async";
      image.onload = async () => {
        this.image = image;
        this.classList.add("has-artwork");
        this.fitArtwork("fill", { silent: true });
        this.updateQualityMessage();
        this.setStatus("Artwork loaded. Drag on the preview to adjust placement.", this.isRecommendedResolution() ? "ready" : "warning");
        this.updateProperties();

        if (this.uploadEndpoint) {
          await this.uploadOriginalFile(file);
        }
      };
      image.onerror = () => {
        this.clearArtwork();
        this.setStatus("This image could not be loaded. Please try another file.", "invalid");
      };
      image.src = this.objectUrl;
    }

    handlePointerDown(event) {
      if (!this.image) {
        return;
      }

      const point = this.getCanvasPoint(event);
      this.drag = {
        id: event.pointerId,
        x: point.x,
        y: point.y,
        offsetX: this.state.offsetX,
        offsetY: this.state.offsetY
      };
      this.canvas.setPointerCapture?.(event.pointerId);
    }

    handlePointerMove(event) {
      if (!this.drag || this.drag.id !== event.pointerId) {
        return;
      }

      const point = this.getCanvasPoint(event);
      this.state.offsetX = this.drag.offsetX + point.x - this.drag.x;
      this.state.offsetY = this.drag.offsetY + point.y - this.drag.y;
      this.render();
    }

    handlePointerUp(event) {
      if (!this.drag || this.drag.id !== event.pointerId) {
        return;
      }

      this.canvas.releasePointerCapture?.(event.pointerId);
      this.drag = null;
      this.updateProperties();
    }

    handleWheel(event) {
      if (!this.image || !this.zoomInput) {
        return;
      }

      event.preventDefault();
      const current = Number(this.zoomInput.value || 100);
      const next = Math.max(Number(this.zoomInput.min || 40), Math.min(Number(this.zoomInput.max || 260), current + (event.deltaY > 0 ? -5 : 5)));
      this.zoomInput.value = String(next);
      this.state.zoom = next / 100;
      this.render();
    }

    handleSubmit(event) {
      if (this.required && !this.fileInput.files?.length) {
        const uploadStepIndex = this.findStepIndex("upload");
        if (uploadStepIndex >= 0) {
          this.setStep(uploadStepIndex, { focus: true });
        }

        this.fileInput.setCustomValidity("Please upload your artwork before adding this custom case to cart.");
        this.setStatus("Please upload your artwork before adding this custom case to cart.", "invalid");
        event.preventDefault();
        event.stopImmediatePropagation();
        this.fileInput.reportValidity();
        return;
      }

      this.fileInput.setCustomValidity("");
      this.updateProperties();
    }

    handleInvalid() {
      if (this.required && !this.fileInput.files?.length) {
        const uploadStepIndex = this.findStepIndex("upload");
        if (uploadStepIndex >= 0) {
          this.setStep(uploadStepIndex, { focus: true });
        }

        this.setStatus("Please upload your artwork before adding this custom case to cart.", "invalid");
      }
    }

    async uploadOriginalFile(file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("product_id", this.dataset.productId || "");
      formData.append("product_handle", this.dataset.productHandle || "");

      try {
        const response = await fetch(this.uploadEndpoint, {
          method: "POST",
          body: formData,
          credentials: "same-origin"
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.message || "Upload failed");
        }

        this.uploadUrl = data.url || data.file_url || data.fileUrl || data.preview_url || "";
        this.setField("upload", this.uploadUrl);
        this.updateProperties();
      } catch (error) {
        this.uploadUrl = "";
        this.setField("upload", "");
        this.setStatus("Preview is ready. The original file will still be attached through the product form.", "warning");
      }
    }

    fitArtwork(mode = "fill", options = {}) {
      if (!this.image) {
        return;
      }

      const box = this.getCaseBox();
      const fitScale = Math.min(box.w / this.image.naturalWidth, box.h / this.image.naturalHeight);
      const fillScale = Math.max(box.w / this.image.naturalWidth, box.h / this.image.naturalHeight);
      this.state.baseScale = mode === "fit" ? fitScale : fillScale;
      this.state.zoom = 1;
      this.state.offsetX = 0;
      this.state.offsetY = 0;

      if (this.zoomInput) {
        this.zoomInput.value = "100";
      }

      this.render();

      if (!options.silent) {
        this.updateProperties();
      }
    }

    resetArtwork() {
      if (!this.image) {
        this.clearArtwork();
        return;
      }

      this.state.rotation = 0;
      this.state.text = "";
      this.state.textColor = "#111111";
      this.state.sticker = "";
      if (this.rotateInput) this.rotateInput.value = "0";
      if (this.textInput) this.textInput.value = "";
      const blackText = this.textColorInputs.find((input) => input.value === "#111111");
      if (blackText) blackText.checked = true;
      this.stickerButtons.forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.caseSticker === "none");
      });
      this.fitArtwork("fill");
    }

    clearArtwork() {
      this.revokeObjectUrl();
      this.image = null;
      this.file = null;
      this.uploadUrl = "";
      this.classList.remove("has-artwork", "is-ready", "is-warning", "is-invalid");
      if (this.fileName) {
        this.fileName.textContent = "PNG, JPG or WEBP. Transparent PNG works best.";
      }
      if (this.quality) {
        this.quality.textContent = `Recommended ${this.recommendedWidth} x ${this.recommendedHeight}px or higher.`;
      }
      this.setStatus("Choose an image to begin.", "");
      this.draw();
      this.updateProperties();
    }

    revokeObjectUrl() {
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = "";
      }
    }

    render() {
      this.draw();
      this.updateProperties();
    }

    draw() {
      const ctx = this.ctx;
      const canvas = this.canvas;
      if (!ctx || !canvas) {
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawBackdrop(ctx);

      const box = this.getCaseBox();
      this.roundRect(ctx, box.x + 7, box.y + 14, box.w, box.h, box.r);
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.filter = "blur(18px)";
      ctx.fill();
      ctx.filter = "none";

      this.roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
      ctx.fillStyle = "#fafafa";
      ctx.fill();

      ctx.save();
      this.roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
      ctx.clip();

      if (this.baseImage) {
        this.drawImageCover(ctx, this.baseImage, box);
      } else {
        ctx.fillStyle = "#f7f7f7";
        ctx.fillRect(box.x, box.y, box.w, box.h);
      }

      if (this.image) {
        const scale = this.state.baseScale * this.state.zoom;
        const drawWidth = this.image.naturalWidth * scale;
        const drawHeight = this.image.naturalHeight * scale;
        ctx.save();
        ctx.translate(box.x + box.w / 2 + this.state.offsetX, box.y + box.h / 2 + this.state.offsetY);
        ctx.rotate(this.degreesToRadians(this.state.rotation));
        ctx.drawImage(this.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(box.x, box.y, box.w * 0.16, box.h);
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(box.x + box.w * 0.84, box.y, box.w * 0.16, box.h);

      if (this.state.text) {
        this.drawTextLayer(ctx, box);
      }

      if (this.state.sticker) {
        this.drawStickerLayer(ctx, box);
      }

      ctx.restore();
      this.drawCameraCutout(ctx, box);
      this.drawCaseChrome(ctx, box);
    }

    drawBackdrop(ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 900, 1200);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(1, "#ececea");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 900, 1200);
    }

    drawImageCover(ctx, image, box) {
      const scale = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      ctx.drawImage(image, box.x + (box.w - width) / 2, box.y + (box.h - height) / 2, width, height);
    }

    drawCaseChrome(ctx, box) {
      this.roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(17, 17, 17, 0.9)";
      ctx.stroke();

      this.roundRect(ctx, box.x + 20, box.y + 20, box.w - 40, box.h - 40, Math.max(20, box.r - 20));
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.64)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(box.x + box.w / 2, box.y + box.h - 42, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fill();
    }

    drawCameraCutout(ctx, box) {
      const camera = {
        x: box.x + 46,
        y: box.y + 48,
        w: 132,
        h: 132,
        r: 34
      };

      this.roundRect(ctx, camera.x, camera.y, camera.w, camera.h, camera.r);
      ctx.fillStyle = "#f8f8f8";
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#101010";
      ctx.stroke();

      const holes = [
        [camera.x + 42, camera.y + 42, 20],
        [camera.x + 90, camera.y + 42, 17],
        [camera.x + 42, camera.y + 90, 17]
      ];

      holes.forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#111";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        ctx.fill();
      });
    }

    drawTextLayer(ctx, box) {
      const text = this.state.text.slice(0, 28);
      const maxWidth = box.w * 0.72;
      let fontSize = 58;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${fontSize}px Arial, sans-serif`;

      while (ctx.measureText(text).width > maxWidth && fontSize > 24) {
        fontSize -= 2;
        ctx.font = `700 ${fontSize}px Arial, sans-serif`;
      }

      const x = box.x + box.w / 2;
      const y = box.y + box.h * 0.76;
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(4, fontSize * 0.09);
      ctx.strokeStyle = this.state.textColor === "#ffffff" ? "rgba(0,0,0,0.48)" : "rgba(255,255,255,0.72)";
      ctx.strokeText(text, x, y, maxWidth);
      ctx.fillStyle = this.state.textColor;
      ctx.fillText(text, x, y, maxWidth);
    }

    drawStickerLayer(ctx, box) {
      const size = Math.min(96, box.w * 0.22);
      const x = box.x + box.w * 0.72;
      const y = box.y + box.h * 0.28;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.degreesToRadians(-8));

      if (this.state.sticker === "star") {
        this.drawStar(ctx, 0, 0, size * 0.5, size * 0.24, 5);
        ctx.fillStyle = "#ffd119";
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#111";
        ctx.stroke();
      } else if (this.state.sticker === "heart") {
        ctx.beginPath();
        ctx.moveTo(0, size * 0.34);
        ctx.bezierCurveTo(-size * 0.62, -size * 0.08, -size * 0.34, -size * 0.56, 0, -size * 0.26);
        ctx.bezierCurveTo(size * 0.34, -size * 0.56, size * 0.62, -size * 0.08, 0, size * 0.34);
        ctx.closePath();
        ctx.fillStyle = "#ff5a6a";
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#111";
        ctx.stroke();
      } else if (this.state.sticker === "smile") {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.46, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd119";
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#111";
        ctx.stroke();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(-size * 0.16, -size * 0.1, size * 0.045, 0, Math.PI * 2);
        ctx.arc(size * 0.16, -size * 0.1, size * 0.045, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, size * 0.02, size * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.stroke();
      } else if (this.state.sticker === "bolt") {
        ctx.beginPath();
        ctx.moveTo(-size * 0.08, -size * 0.5);
        ctx.lineTo(size * 0.28, -size * 0.08);
        ctx.lineTo(size * 0.04, -size * 0.08);
        ctx.lineTo(size * 0.18, size * 0.5);
        ctx.lineTo(-size * 0.3, -size * 0.02);
        ctx.lineTo(-size * 0.06, -size * 0.02);
        ctx.closePath();
        ctx.fillStyle = "#b7ff3c";
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111";
        ctx.stroke();
      }

      ctx.restore();
    }

    drawStar(ctx, x, y, outerRadius, innerRadius, points) {
      ctx.beginPath();

      for (let i = 0; i < points * 2; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI / points;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.closePath();
    }

    getCaseBox() {
      return {
        x: 255,
        y: 88,
        w: 390,
        h: 870,
        r: 72
      };
    }

    getCanvasPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
      return { x, y };
    }

    roundRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }

    degreesToRadians(degrees) {
      return degrees * Math.PI / 180;
    }

    updateQualityMessage() {
      if (!this.image || !this.quality) {
        return;
      }

      const width = this.image.naturalWidth;
      const height = this.image.naturalHeight;
      const qualityText = this.isRecommendedResolution()
        ? `Print-ready size: ${width} x ${height}px.`
        : `Low resolution: ${width} x ${height}px. Recommended ${this.recommendedWidth} x ${this.recommendedHeight}px or higher.`;
      this.quality.textContent = qualityText;
    }

    isRecommendedResolution() {
      if (!this.image) {
        return false;
      }

      const actualLong = Math.max(this.image.naturalWidth, this.image.naturalHeight);
      const actualShort = Math.min(this.image.naturalWidth, this.image.naturalHeight);
      const recommendedLong = Math.max(this.recommendedWidth, this.recommendedHeight);
      const recommendedShort = Math.min(this.recommendedWidth, this.recommendedHeight);
      return actualLong >= recommendedLong && actualShort >= recommendedShort;
    }

    setStatus(message, tone = "") {
      if (this.status) {
        this.status.textContent = message;
      }

      this.classList.toggle("is-ready", tone === "ready");
      this.classList.toggle("is-warning", tone === "warning");
      this.classList.toggle("is-invalid", tone === "invalid");
    }

    updateProperties() {
      const hasArtwork = Boolean(this.image && this.file);
      const variantId = this.form?.elements?.id?.value || "";
      const selectedOptions = this.selectedOptions || getSelectedOptions(this.dataset.formId || "", this.form);
      const deviceOption = getNamedOption(selectedOptions, deviceNamePattern);
      const caseTypeOption = getNamedOption(selectedOptions, caseTypeNamePattern);
      const selectedOptionsText = selectedOptions.map((option) => `${option.name}: ${option.label}`).join(" / ");
      const baseText = this.baseLabel || this.baseImageUrl || "";
      const payload = hasArtwork ? {
        version: 2,
        productId: this.dataset.productId || "",
        productHandle: this.dataset.productHandle || "",
        variantId,
        selectedOptions,
        previewBase: {
          label: this.baseLabel,
          image: this.baseImageUrl
        },
        fileName: this.file.name,
        fileType: this.file.type,
        fileSize: this.file.size,
        imageWidth: this.image.naturalWidth,
        imageHeight: this.image.naturalHeight,
        zoomPercent: Math.round(this.state.zoom * 100),
        rotation: Number(this.state.rotation.toFixed(2)),
        offsetX: Math.round(this.state.offsetX),
        offsetY: Math.round(this.state.offsetY),
        text: this.state.text,
        textColor: this.state.textColor,
        sticker: this.state.sticker,
        uploadUrl: this.uploadUrl
      } : null;

      this.setField("status", hasArtwork ? `Uploaded artwork: ${this.file.name}` : "");
      this.setField("device", deviceOption?.label || "");
      this.setField("caseType", caseTypeOption?.label || "");
      this.setField("selectedOptions", selectedOptionsText);
      this.setField("base", baseText);
      this.setField(
        "placement",
        hasArtwork
          ? `Zoom ${Math.round(this.state.zoom * 100)}%, rotate ${Number(this.state.rotation.toFixed(1))}deg, x ${Math.round(this.state.offsetX)}, y ${Math.round(this.state.offsetY)}`
          : ""
      );
      this.setField("text", hasArtwork && this.state.text ? this.state.text : "");
      this.setField("sticker", this.state.sticker || "");
      this.setField("payload", payload ? JSON.stringify(payload) : "");
      this.setField("upload", this.uploadUrl || "");
    }

    setField(name, value) {
      const field = this.fields?.[name];
      if (!field) {
        return;
      }

      field.value = value || "";
      field.disabled = !value;
    }
  }

  window.customElements.define("case-customizer", CaseCustomizer);
})();
