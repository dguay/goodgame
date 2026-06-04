export interface ArticleTimeFields {
  published_at: string | null;
  fetched_at: string;
  created_at: string;
}

export function effectiveArticleTime(article: ArticleTimeFields): string {
  return article.published_at ?? article.fetched_at ?? article.created_at;
}
