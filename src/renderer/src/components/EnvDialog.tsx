import { memo, useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogContent,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { envAtom } from '@/models/detail';

interface EnvDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'custom', label: '自定义（OpenAI 兼容）' },
];

export const EnvDialog = memo((props: EnvDialogProps) => {
  const { open, onOpenChange } = props;
  const env = useAtomValue(envAtom);
  const setEnv = useSetAtom(envAtom);
  const [cookie, setCookie] = useState(env.cookie);
  const [tushareToken, setTushareToken] = useState(env.tushareToken);
  const [llmProvider, setLlmProvider] = useState(env.llmProvider || 'deepseek');
  const [llmModel, setLlmModel] = useState(env.llmModel || 'deepseek-chat');
  const [llmApiKey, setLlmApiKey] = useState(env.llmApiKey || '');
  const [llmBaseUrl, setLlmBaseUrl] = useState(env.llmBaseUrl || '');

  useEffect(() => {
    if (open) {
      setCookie(env.cookie);
      setTushareToken(env.tushareToken);
      setLlmProvider(env.llmProvider || 'deepseek');
      setLlmModel(env.llmModel || 'deepseek-chat');
      setLlmApiKey(env.llmApiKey || '');
      setLlmBaseUrl(env.llmBaseUrl || '');
    }
  }, [env, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>设置环境变量</DialogTitle>
        <DialogDescription>后续请求会默认带上这里填写的配置。</DialogDescription>
        <div className="flex flex-col gap-4 w-full overflow-y-auto max-h-[70vh] p-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-cookie">东方财富 Cookie</Label>
            <Textarea
              id="env-cookie"
              className="resize-none h-[120px] w-full"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              spellCheck={false}
              placeholder="请输入完整 Cookie"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-tushare-token">Tushare Token</Label>
            <Input
              id="env-tushare-token"
              value={tushareToken}
              onChange={(e) => setTushareToken(e.target.value)}
              spellCheck={false}
              placeholder="请输入 Tushare Token"
            />
          </div>

          <div className="pt-3">
            <div className="title mb-2 text-sm">投资 Agent · LLM 配置</div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>提供商</Label>
                <Select value={llmProvider} onValueChange={setLlmProvider}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择提供商" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="env-llm-model">模型</Label>
                <Input
                  id="env-llm-model"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  spellCheck={false}
                  placeholder="deepseek-chat / deepseek-reasoner / gpt-4o-mini ..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="env-llm-api-key">API Key</Label>
                <Input
                  id="env-llm-api-key"
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  spellCheck={false}
                  placeholder="sk-...（留空则读取环境变量）"
                />
              </div>
              {llmProvider === 'custom' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="env-llm-base-url">Base URL</Label>
                  <Input
                    id="env-llm-base-url"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    spellCheck={false}
                    placeholder="https://your-openai-compatible-endpoint/v1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              setEnv({
                cookie: cookie.trim(),
                tushareToken: tushareToken.trim(),
                llmProvider,
                llmModel: llmModel.trim(),
                llmApiKey: llmApiKey.trim(),
                llmBaseUrl: llmBaseUrl.trim(),
              });
              onOpenChange?.(false);
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

EnvDialog.displayName = 'EnvDialog';
