import { useEffect } from "react";

const SITE_NAME = "ХочуТо";
const DEFAULT_DESCRIPTION =
  "Платформа аренды вещей с гарантийным фондом. Арендуйте инструменты, технику, туристическое снаряжение и многое другое — безопасно и выгодно.";
const DEFAULT_IMAGE = "https://www.hochuto.ru/images/og-default.png";

interface DocumentMetaOptions {
  title?: string;
  description?: string;
  image?: string;
  noindex?: boolean;
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setOgMeta(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Устанавливает title, description и og-теги для текущей страницы.
 * При размонтировании автоматически сбрасывает на значения по умолчанию.
 *
 * @example
 * useDocumentMeta({ title: "Каталог аренды", description: "Тысячи вещей..." });
 */
export function useDocumentMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  noindex = false,
}: DocumentMetaOptions = {}) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = fullTitle;

    setMeta("description", description);
    setOgMeta("og:title", fullTitle);
    setOgMeta("og:description", description);
    setOgMeta("og:image", image);
    setOgMeta("og:site_name", SITE_NAME);
    setOgMeta("og:type", "website");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);

    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement("meta");
        robotsMeta.name = "robots";
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.content = "noindex,nofollow";
    } else if (robotsMeta) {
      robotsMeta.content = "index,follow";
    }

    return () => {
      document.title = prevTitle;
    };
  }, [fullTitle, description, image, noindex]);
}
