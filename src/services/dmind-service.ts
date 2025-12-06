/**
 * DMind Service - 与本地 Python Server 通信
 */

export interface HealthResponse {
  status: string;
  version: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  content: string;
  metadata?: Record<string, any>;
}

export interface TechDesignResponse {
  status: string;
  draft?: string;
  draft_id?: string;
  diff?: {
    old: string;
    new: string;
  };
  fragments_used: string[];
}

export class DMindService {
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  setServerUrl(url: string) {
    this.serverUrl = url;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.serverUrl}/api${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Server error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  /**
   * 聊天接口
   */
  async chat(
    messages: ChatMessage[],
    vaultPath?: string,
    currentFile?: string,
    context?: Record<string, any>
  ): Promise<ChatResponse> {
    return this.request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({
        messages,
        vault_path: vaultPath,
        current_file: currentFile,
        context,
      }),
    });
  }

  /**
   * 更新技术设计文档
   */
  async updateTechDesign(
    vaultPath: string,
    topics: string[],
    forceUpdate: boolean = false
  ): Promise<TechDesignResponse> {
    return this.request<TechDesignResponse>("/tech-design/update", {
      method: "POST",
      body: JSON.stringify({
        vault_path: vaultPath,
        topics,
        force_update: forceUpdate,
      }),
    });
  }

  /**
   * 接受草稿
   */
  async acceptDraft(
    vaultPath: string,
    draftId: string
  ): Promise<{ status: string; file: string }> {
    return this.request("/tech-design/accept", {
      method: "POST",
      body: JSON.stringify({
        vault_path: vaultPath,
        draft_id: draftId,
      }),
    });
  }

  /**
   * 列出碎片
   */
  async listFragments(
    vaultPath: string,
    topics?: string[]
  ): Promise<{ fragments: any[] }> {
    const params = new URLSearchParams({ vault_path: vaultPath });
    if (topics && topics.length > 0) {
      params.append("topics", topics.join(","));
    }
    return this.request(`/fragments?${params.toString()}`);
  }
}
