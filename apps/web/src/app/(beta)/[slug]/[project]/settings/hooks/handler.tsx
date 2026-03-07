import { api } from "@beakcrypt/convex";
import { isFailure, HttpStatus } from "@beakcrypt/shared";
import { fetchAuthQuery, preloadAuthQuery } from "@beakcrypt/convex/auth";
import { notFound, redirect } from "next/navigation";
import HooksContent from "./content";

export default async function HooksHandler({
  paramsPromise,
}: {
  paramsPromise: Promise<{ slug: string; project: string }>;
}) {
  const { slug, project: projectName } = await paramsPromise;

  const projectResult = await fetchAuthQuery(api.projects.getBySlugAndName, {
    orgSlug: slug,
    name: projectName,
  });

  if (isFailure(projectResult)) {
    if (projectResult.status === HttpStatus.NOT_FOUND) {
      return notFound();
    }
    if (
      projectResult.status === HttpStatus.UNAUTHORIZED ||
      projectResult.status === HttpStatus.FORBIDDEN
    ) {
      redirect(
        `/auth?callbackURL=${encodeURIComponent(`/${slug}/${projectName}/settings/hooks`)}`,
      );
    }
    return notFound();
  }

  const preloadedEnvironments = await preloadAuthQuery(api.environments.list, {
    projectId: projectResult.data._id,
  });

  return (
    <HooksContent
      slug={slug}
      project={projectResult.data}
      preloadedEnvironments={preloadedEnvironments}
    />
  );
}
