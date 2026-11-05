import { useUiText } from "@/hooks/useUiText";
import { useState } from "react";
import { Copy, Facebook, Linkedin, Mail, MessageCircle, Send, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const SocialShare = ({ title, complaintId }: { title: string; complaintId: string }) => {
  const tx = useUiText();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const url = `${window.location.origin}/complaints/${complaintId}`;
  const text = `Check out this civic complaint: ${title}`;

  const openShareWindow = (shareUrl: string) => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      toast.info(tx("Choose a platform from the menu to share this report"));
      return;
    }
    try {
      await navigator.share({ title, text, url });
    } catch {
      // user cancelled
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(tx("Link copied"));
    } catch {
      toast.error(tx("Could not copy link"));
    }
  };

  const shareOptions = [
    {
      label: "Share via device",
      icon: Share2,
      onClick: handleNativeShare,
      gradient: "from-primary to-primary/70",
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      onClick: () => openShareWindow(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`),
      gradient: "from-[#25D366] to-[#128C7E]",
      iconColor: "text-[#25D366]",
      bgColor: "bg-[#25D366]/10",
    },
    {
      label: "Telegram",
      icon: Send,
      onClick: () => openShareWindow(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`),
      gradient: "from-[#0088cc] to-[#005f8a]",
      iconColor: "text-[#0088cc]",
      bgColor: "bg-[#0088cc]/10",
    },
    {
      label: "Facebook",
      icon: Facebook,
      onClick: () => openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
      gradient: "from-[#1877F2] to-[#0d5dbf]",
      iconColor: "text-[#1877F2]",
      bgColor: "bg-[#1877F2]/10",
    },
    {
      label: "X / Twitter",
      icon: Twitter,
      onClick: () => openShareWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`),
      gradient: "from-foreground to-foreground/70",
      iconColor: "text-foreground",
      bgColor: "bg-foreground/10",
    },
    {
      label: "LinkedIn",
      icon: Linkedin,
      onClick: () => openShareWindow(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`),
      gradient: "from-[#0A66C2] to-[#074a8f]",
      iconColor: "text-[#0A66C2]",
      bgColor: "bg-[#0A66C2]/10",
    },
    {
      label: "Email",
      icon: Mail,
      onClick: () => openShareWindow(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`),
      gradient: "from-warning to-warning/70",
      iconColor: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Copy link",
      icon: Copy,
      onClick: copyLink,
      gradient: "from-success to-success/70",
      iconColor: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  const TriggerButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (isMobile) setOpen(true);
      }}
      className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-all duration-300"
    >
      <Share2 className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
      <span className="font-medium">{tx("Share")}</span>
    </button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{TriggerButton}</SheetTrigger>
        <SheetContent
          side="bottom"
          onClick={(e) => e.stopPropagation()}
          className="rounded-t-3xl border-t border-border/50 bg-popover/95 backdrop-blur-xl px-4 pb-8 pt-3 max-h-[85vh] overflow-y-auto"
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="text-base">{tx("Share this report")}</SheetTitle>
            <SheetDescription className="text-xs">{tx("Spread the word & drive impact")}</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-3">
            {shareOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={tx(opt.label)}
                  onClick={() => {
                    opt.onClick();
                    setOpen(false);
                  }}
                  className="group/item flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-200 active:scale-95 hover:bg-accent/40"
                >
                  <div
                    className={`relative flex items-center justify-center w-12 h-12 rounded-2xl ${opt.bgColor} overflow-hidden transition-transform duration-300 group-hover/item:scale-105 shadow-sm`}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${opt.gradient} opacity-0 group-active/item:opacity-100 transition-opacity duration-200`}
                    />
                    <Icon className={`relative w-5 h-5 ${opt.iconColor} group-active/item:text-white transition-colors`} />
                  </div>
                  <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2">
                    {tx(opt.label)}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{TriggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        onClick={(e) => e.stopPropagation()}
        className="w-64 max-h-[70vh] overflow-y-auto p-2 rounded-2xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl animate-scale-in"
      >
        <div className="px-2 py-2 mb-1 border-b border-border/40">
          <p className="text-xs font-semibold text-foreground">{tx("Share this report")}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{tx("Spread the word & drive impact")}</p>
        </div>
        <div className="space-y-0.5 pt-1">
          {shareOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <DropdownMenuItem
                key={tx(opt.label)}
                onClick={opt.onClick}
                className="group/item flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-accent/60 focus:bg-accent/60 data-[highlighted]:bg-accent/60"
              >
                <div
                  className={`relative flex items-center justify-center w-9 h-9 rounded-xl ${opt.bgColor} transition-all duration-300 group-hover/item:scale-110 group-hover/item:shadow-lg overflow-hidden`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${opt.gradient} opacity-0 group-hover/item:opacity-100 transition-opacity duration-300`}
                  />
                  <Icon
                    className={`relative w-4 h-4 ${opt.iconColor} transition-colors duration-300 group-hover/item:text-white`}
                  />
                </div>
                <span className="text-sm font-medium text-foreground flex-1">{tx(opt.label)}</span>
                <span className="text-muted-foreground opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300">
                  →
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SocialShare;
