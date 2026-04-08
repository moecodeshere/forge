import {
  AlertCircle,
  Bot,
  Clock,
  Database,
  FileText,
  Filter,
  Globe,
  Image,
  Mail,
  MousePointer,
  PauseCircle,
  Play,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Timer,
  Wifi,
} from "lucide-react";
import type { ForgeNodeType } from "@/lib/stores/graphStore";

const ICON_SIZE = 14;

export function getNodeIcon(type: ForgeNodeType): React.ReactNode {
  const iconProps = { className: "shrink-0", size: ICON_SIZE };
  switch (type) {
    case "manual_trigger":
      return <Play {...iconProps} />;
    case "webhook_trigger":
      return <Wifi {...iconProps} />;
    case "schedule_trigger":
      return <Clock {...iconProps} />;
    case "form_submission_trigger":
    case "app_event_trigger":
      return <Mail {...iconProps} />;
    case "simple_llm":
    case "llm_caller":
    case "ai_agent":
      return <Sparkles {...iconProps} />;
    case "rag_retriever":
      return <Bot {...iconProps} />;
    case "research":
      return <Search {...iconProps} />;
    case "web_scrape":
      return <Globe {...iconProps} />;
    case "vision_extract":
      return <Image {...iconProps} />;
    case "sql_query":
      return <Database {...iconProps} />;
    case "loop":
      return <Repeat {...iconProps} />;
    case "template_render":
      return <FileText {...iconProps} />;
    case "pdf_report":
      return <FileText {...iconProps} />;
    case "wait_callback":
      return <PauseCircle {...iconProps} />;
    case "error_handler":
      return <AlertCircle {...iconProps} />;
    case "http_request":
      return <Globe {...iconProps} />;
    case "mcp_tool":
      return <Settings {...iconProps} />;
    case "action":
      return <Settings {...iconProps} />;
    case "set_node":
    case "merge":
    case "json_parse":
    case "json_stringify":
      return <Settings {...iconProps} />;
    case "conditional_branch":
    case "filter":
      return <Filter {...iconProps} />;
    case "delay":
      return <Timer {...iconProps} />;
    case "approval_step":
      return <MousePointer {...iconProps} />;
    default:
      return null;
  }
}
