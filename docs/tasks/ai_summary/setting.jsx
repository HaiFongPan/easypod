import React, { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";

interface Model {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  apiHost: string;
  apiKey: string;
  models: Model[];
}

export default function LLMProviderConfig() {
  const [providers, setProviders] = useState<Provider[]>([
    {
      id: "openai",
      name: "OpenAI",
      apiHost: "https://api.openai.com/v1",
      apiKey: "",
      models: [{ id: "gpt-4o", name: "gpt-4o" }],
    },
  ]);

  const [selectedProviderId, setSelectedProviderId] = useState("openai");
  const [defaultProvider, setDefaultProvider] = useState("openai");

  const addProvider = () => {
    const id = `provider-${Date.now()}`;
    const newProvider = {
      id,
      name: "New Provider",
      apiHost: "",
      apiKey: "",
      models: [],
    };
    setProviders([...providers, newProvider]);
    setSelectedProviderId(id);
  };

  const removeProvider = (id: string) => {
    const filtered = providers.filter((p) => p.id !== id);
    setProviders(filtered);
    if (selectedProviderId === id && filtered.length > 0) {
      setSelectedProviderId(filtered[0].id);
    }
  };

  const updateProvider = (id: string, key: keyof Provider, value: any) => {
    setProviders(
      providers.map((p) => (p.id === id ? { ...p, [key]: value } : p))
    );
  };

  const addModel = (providerId: string) => {
    setProviders(
      providers.map((p) =>
        p.id === providerId
          ? {
              ...p,
              models: [
                ...p.models,
                { id: `model-${Date.now()}`, name: "new-model" },
              ],
            }
          : p
      )
    );
  };

  const removeModel = (providerId: string, modelId: string) => {
    setProviders(
      providers.map((p) =>
        p.id === providerId
          ? { ...p, models: p.models.filter((m) => m.id !== modelId) }
          : p
      )
    );
  };

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  return (
    <div className="flex h-[80vh] border rounded-xl overflow-hidden">
      {/* Left Panel */}
      <div className="w-1/3 border-r bg-gray-50 flex flex-col">
        <div className="p-4 font-semibold text-lg border-b">Providers</div>
        <div className="flex-1 overflow-y-auto">
          {providers.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-2 cursor-pointer border-b hover:bg-gray-100 ${
                selectedProviderId === p.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
              }`}
              onClick={() => setSelectedProviderId(p.id)}
            >
              <span className="truncate">{p.name}</span>
              <div className="flex items-center gap-2">
                {defaultProvider === p.id && (
                  <Star size={14} className="text-yellow-400" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeProvider(p.id);
                  }}
                  className="text-gray-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <button
            onClick={addProvider}
            className="w-full flex items-center justify-center gap-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={16} /> 添加 Provider
          </button>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 p-6 overflow-y-auto bg-white">
        {selectedProvider ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <input
                type="text"
                className="text-2xl font-semibold border-none focus:ring-0 w-2/3"
                value={selectedProvider.name}
                onChange={(e) =>
                  updateProvider(selectedProvider.id, "name", e.target.value)
                }
              />
              <button
                onClick={() => setDefaultProvider(selectedProvider.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md border ${
                  defaultProvider === selectedProvider.id
                    ? "bg-yellow-100 border-yellow-400 text-yellow-700"
                    : "border-gray-300 hover:bg-gray-100"
                }`}
              >
                <Star size={16} />
                {defaultProvider === selectedProvider.id
                  ? "默认 Provider"
                  : "设为默认"}
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  API Host
                </label>
                <input
                  type="text"
                  value={selectedProvider.apiHost}
                  onChange={(e) =>
                    updateProvider(selectedProvider.id, "apiHost", e.target.value)
                  }
                  className="w-full border rounded-md p-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={selectedProvider.apiKey}
                  onChange={(e) =>
                    updateProvider(selectedProvider.id, "apiKey", e.target.value)
                  }
                  className="w-full border rounded-md p-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Models</h3>
                <button
                  onClick={() => addModel(selectedProvider.id)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + 添加模型
                </button>
              </div>
              <ul className="space-y-2">
                {selectedProvider.models.map((m) => (
                  <li
                    key={m.id}
                    className="flex justify-between items-center border rounded-md px-3 py-2"
                  >
                    <input
                      type="text"
                      className="flex-1 bg-transparent focus:ring-0"
                      value={m.name}
                      onChange={(e) =>
                        setProviders(
                          providers.map((p) =>
                            p.id === selectedProvider.id
                              ? {
                                  ...p,
                                  models: p.models.map((mm) =>
                                    mm.id === m.id
                                      ? { ...mm, name: e.target.value }
                                      : mm
                                  ),
                                }
                              : p
                          )
                        )
                      }
                    />
                    <button
                      onClick={() => removeModel(selectedProvider.id, m.id)}
                      className="text-gray-500 hover:text-red-600 ml-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="text-gray-400 text-center mt-10">
            请选择一个 Provider 查看详情
          </div>
        )}
      </div>
    </div>
  );
}

