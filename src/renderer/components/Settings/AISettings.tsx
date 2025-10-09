import React, { useEffect, useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import Button from "../Button/Button";
import Input from "../Input/Input";
import { getElectronAPI } from "../../utils/electron";

interface LLMProvider {
  id: number;
  name: string;
  baseUrl: string;
  apiKey: string | null;
  headersJson: string | null;
  timeout: number | null;
  tokenUsage: number | null;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface LLMModel {
  id: number;
  providerId: number;
  name: string;
  code: string;
  tokenUsage: number | null;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Prompt {
  id: number;
  name: string | null;
  type: string;
  prompt: string;
  isBuiltin: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export const AISettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"providers" | "prompts">(
    "providers",
  );
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProviderName, setEditingProviderName] = useState(false);
  const [providerNameDraft, setProviderNameDraft] = useState("");
  const [validatingProvider, setValidatingProvider] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [validationSuccess, setValidationSuccess] = useState<boolean | null>(
    null,
  );

  const electronAPI = getElectronAPI();

  // Load providers and models
  useEffect(() => {
    loadProviders();
    loadPrompts();
  }, []);

  useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId);
    }
    setValidationMessage(null);
    setValidationSuccess(null);
  }, [selectedProviderId]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const result = await electronAPI.llmProviders.getAll();
      const providersList = Array.isArray(result) ? result : [];
      setProviders(providersList);
      if (providersList.length > 0 && !selectedProviderId) {
        setSelectedProviderId(providersList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async (providerId: number) => {
    try {
      const result = await electronAPI.llmModels.getByProvider(providerId);
      const modelsList = Array.isArray(result) ? result : [];
      setModels(modelsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
      setModels([]);
    }
  };

  const loadPrompts = async () => {
    try {
      const result = await electronAPI.prompts.getAll();
      const promptsList = Array.isArray(result) ? result : [];
      setPrompts(promptsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompts");
      setPrompts([]);
    }
  };

  const addProvider = async () => {
    try {
      const newProvider = {
        name: "New Provider",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        headersJson: null,
        timeout: 30000,
      };
      await electronAPI.llmProviders.create(newProvider);
      // Reload providers list
      const result = await electronAPI.llmProviders.getAll();
      const providersList = Array.isArray(result) ? result : [];
      setProviders(providersList);
      // Auto-focus on the first provider (newest one since sorted by createdAt desc)
      if (providersList.length > 0) {
        setSelectedProviderId(providersList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add provider");
    }
  };

  const updateProvider = async (id: number, data: Partial<LLMProvider>) => {
    try {
      await electronAPI.llmProviders.update(id, data);
      await loadProviders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update provider",
      );
    }
  };

  const deleteProvider = async (id: number) => {
    try {
      await electronAPI.llmProviders.delete(id);
      await loadProviders();
      if (selectedProviderId === id && providers.length > 1) {
        setSelectedProviderId(providers.find((p) => p.id !== id)?.id || null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete provider",
      );
    }
  };

  const setDefaultProvider = async (id: number) => {
    try {
      await electronAPI.llmProviders.setDefault(id);
      await loadProviders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set default provider",
      );
    }
  };

  const resetValidationState = () => {
    setValidationMessage(null);
    setValidationSuccess(null);
  };

  const validateProvider = async (providerId: number) => {
    try {
      setValidatingProvider(true);
      resetValidationState();
      const result = await electronAPI.llmProviders.validate(providerId);
      if (result.success) {
        if (selectedProviderId === providerId) {
          await loadModels(providerId);
        }
        setValidationSuccess(true);
        const successMessage =
          result.message ||
          (typeof result.modelsAdded === "number"
            ? `验证成功，新增 ${result.modelsAdded} 个模型`
            : "验证成功");
        setValidationMessage(successMessage);
      } else {
        setValidationSuccess(false);
        setValidationMessage(result.error || "验证失败");
      }
    } catch (err) {
      setValidationSuccess(false);
      setValidationMessage(
        err instanceof Error ? err.message : "验证失败，请稍后再试",
      );
    } finally {
      setValidatingProvider(false);
    }
  };

  const addModel = async (providerId: number) => {
    try {
      const newModel = {
        providerId,
        name: "New Model",
        code: "new-model",
      };
      await electronAPI.llmModels.create(newModel);
      await loadModels(providerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add model");
    }
  };

  const updateModel = async (id: number, data: Partial<LLMModel>) => {
    try {
      await electronAPI.llmModels.update(id, data);
      if (selectedProviderId) {
        await loadModels(selectedProviderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update model");
    }
  };

  const deleteModel = async (id: number) => {
    try {
      await electronAPI.llmModels.delete(id);
      if (selectedProviderId) {
        await loadModels(selectedProviderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete model");
    }
  };

  const setDefaultModel = async (providerId: number, modelId: number) => {
    try {
      await electronAPI.llmModels.setDefault(providerId, modelId);
      await loadModels(providerId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set default model",
      );
    }
  };

  const addPrompt = async () => {
    try {
      const newPrompt = {
        name: "New Prompt",
        type: "summary",
        prompt: "请总结以下内容...",
        isBuiltin: false,
      };
      await electronAPI.prompts.create(newPrompt);
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add prompt");
    }
  };

  const updatePrompt = async (id: number, data: Partial<Prompt>) => {
    try {
      await electronAPI.prompts.update(id, data);
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update prompt");
    }
  };

  const deletePrompt = async (id: number) => {
    try {
      await electronAPI.prompts.delete(id);
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete prompt");
    }
  };

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AI 功能配置
        </h3>
        {/* <p className="mt-1 text-sm text-gray-600 dark:text-gray-400"> */}
        {/* 配置 LLM Provider、模型和提示词模板 */}
        {/* </p> */}
      </div>

      {error && (
        <div className="shrink-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("providers")}
            className={`${
              activeTab === "providers"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Providers
          </button>
        </nav>
      </div>

      {/* Providers Tab */}
      {
        <div className="flex flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Left Panel - Provider List */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col min-h-0">
            {/* <div className="p-4 font-semibold text-sm border-b border-gray-200 dark:border-gray-700"> */}
            {/*   Providers */}
            {/* </div> */}
            <div className="flex-1 overflow-y-auto">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 ${
                    selectedProviderId === provider.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                      : ""
                  }`}
                  onClick={() => setSelectedProviderId(provider.id)}
                >
                  <span className="truncate text-sm text-gray-900 dark:text-gray-100">
                    {provider.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {provider.isDefault && (
                      <Star
                        size={14}
                        className="text-yellow-500 fill-yellow-500"
                      />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProvider(provider.id);
                      }}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={addProvider}
                variant="primary"
                className="w-full"
              >
                <Plus size={16} className="mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* Right Panel - Provider Details */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-gray-900">
            {selectedProvider ? (
              <>
                <div className="flex items-center justify-between p-6 pb-0 shrink-0">
                  {editingProviderName ? (
                    <div className="flex items-center gap-2 flex-1 mr-4">
                      <Input
                        type="text"
                        className="text-xl font-semibold"
                        value={providerNameDraft}
                        onChange={(e) => setProviderNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateProvider(selectedProvider.id, {
                              name: providerNameDraft,
                            });
                            setEditingProviderName(false);
                          } else if (e.key === "Escape") {
                            setEditingProviderName(false);
                            setProviderNameDraft(selectedProvider.name);
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        onClick={() => {
                          updateProvider(selectedProvider.id, {
                            name: providerNameDraft,
                          });
                          setEditingProviderName(false);
                        }}
                        variant="primary"
                        className="shrink-0"
                      >
                        保存
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingProviderName(false);
                          setProviderNameDraft(selectedProvider.name);
                        }}
                        variant="secondary"
                        className="shrink-0"
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <h2
                      className="text-xl font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      onClick={() => {
                        setProviderNameDraft(selectedProvider.name);
                        setEditingProviderName(true);
                      }}
                    >
                      {selectedProvider.name}
                    </h2>
                  )}
                  <button
                    onClick={() => setDefaultProvider(selectedProvider.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm ${
                      selectedProvider.isDefault
                        ? "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400 text-yellow-700 dark:text-yellow-400"
                        : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <Star
                      size={16}
                      className={
                        selectedProvider.isDefault ? "fill-current" : ""
                      }
                    />
                    {/* {selectedProvider.isDefault ? '默认 Provider' : '设为默认'} */}
                  </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Base URL
                      </label>
                      <Input
                        type="text"
                        value={selectedProvider.baseUrl}
                        onChange={(e) => {
                          resetValidationState();
                          updateProvider(selectedProvider.id, {
                            baseUrl: e.target.value,
                          });
                        }}
                        placeholder="https://api.openai.com/v1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Key
                      </label>
                      <Input
                        type="password"
                        value={selectedProvider.apiKey || ""}
                        onChange={(e) => {
                          resetValidationState();
                          updateProvider(selectedProvider.id, {
                            apiKey: e.target.value,
                          });
                        }}
                        placeholder="sk-..."
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => validateProvider(selectedProvider.id)}
                        loading={validatingProvider}
                      >
                        {validatingProvider ? "验证中..." : "验证连接"}
                      </Button>
                      {validationMessage && (
                        <span
                          className={`text-sm ${
                            validationSuccess
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {validationMessage}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Timeout (ms)
                      </label>
                      <Input
                        type="number"
                        value={selectedProvider.timeout || 30000}
                        onChange={(e) =>
                          updateProvider(selectedProvider.id, {
                            timeout: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Token Usage
                      </label>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedProvider.tokenUsage?.toLocaleString() || 0}{" "}
                        tokens
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Models
                      </h4>
                      <button
                        onClick={() => addModel(selectedProvider.id)}
                        className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                      >
                        + 添加模型
                      </button>
                    </div>
                    <div className="space-y-2">
                      {models.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2"
                        >
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <Input
                              type="text"
                              className="bg-transparent text-sm"
                              value={model.name}
                              onChange={(e) =>
                                updateModel(model.id, { name: e.target.value })
                              }
                              placeholder="显示名称 (如: GPT-4)"
                            />
                            <Input
                              type="text"
                              className="bg-transparent text-sm"
                              value={model.code}
                              onChange={(e) =>
                                updateModel(model.id, { code: e.target.value })
                              }
                              placeholder="模型代码 (如: gpt-4)"
                            />
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              onClick={() =>
                                setDefaultModel(selectedProvider.id, model.id)
                              }
                              className={`p-1 rounded ${
                                model.isDefault
                                  ? "text-yellow-500"
                                  : "text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400"
                              }`}
                              title={model.isDefault ? "默认模型" : "设为默认"}
                            >
                              <Star
                                size={16}
                                className={
                                  model.isDefault ? "fill-yellow-500" : ""
                                }
                              />
                            </button>
                            <button
                              onClick={() => deleteModel(model.id)}
                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-400 dark:text-gray-500 text-center mt-10">
                请选择一个 Provider 查看详情
              </div>
            )}
          </div>
        </div>
      }
    </div>
  );
};
