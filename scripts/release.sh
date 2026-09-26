#!/bin/sh
# Usage: npm run release -- 0.0.1
# Pushing the tag fires .github/workflows/release.yml, which publishes the image to GHCR.
set -eu

version="${1:-}"
tag="v$version"

if ! echo "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
	echo "error: pass a semantic version, e.g. npm run release -- 0.0.1" >&2
	exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "error: uncommitted changes, commit them before releasing" >&2
	exit 1
fi

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
	echo "error: tag $tag already exists" >&2
	exit 1
fi

npm run check
git tag -a "$tag" -m "$tag"
git push origin "$tag"
echo "Tagged and pushed $tag. GitHub Actions is building and publishing the image."
