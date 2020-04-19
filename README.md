# Caching for Netlify & lerna projects

Cache node_modules for all lerna packages in Netlify build. An ugly way of solving the problem.

## The problem

Let's look at how lerna / yarn workspace file structure looks like:

![](./images/monorepo-2.svg)
*(image comes from [https://classic.yarnpkg.com/blog/2018/02/15/nohoist/](https://classic.yarnpkg.com/blog/2018/02/15/nohoist/))*

The `yarn install` command will be executed quickly only when all `node_modules` directories are in place. That's the problem with Netlify it only caches root-level `node_modules`.

What's worse, because of current API limitation, it's impossible to run plugins before `yarn install` command. **Correct me if I'm wrong!**

## The solution

I looked at Netlify's build scripts ([https://github.com/netlify/build-image/](https://github.com/netlify/build-image/)) and realized that it simply uses `mv` command on root-level `node_modules` directory.

I started playing around with the build process and realized that you can put anything you want in the `node_modules` after the build and access it during the next one.

The next problem was - how to execute any code before `yarn install`? Build command executes when all dependencies are already installed. Then I thought `preinstall` hook in the root-level package.json! It gets executed right before `yarn install` and you can put any code you want!


## Usage

I use 2 bash scripts, it looks for packages in 2 directories "apps" and "packages":

- netlify-lerna-restore:

```
#!/bin/sh
NODE_MODULES_CACHE="./node_modules"
LERNA_CACHE="$NODE_MODULES_CACHE/lerna-cache"

mkdir -p "$NODE_MODULES_CACHE/lerna-cache"

restore_deps() {
    PACKAGES=$(ls -1 $1)

    for PKG in $PACKAGES
    do
        PKG_CACHE="$LERNA_CACHE/$PKG"
        if [ -d $PKG_CACHE ];
        then
            mv $PKG_CACHE $1/$PKG/node_modules
            echo "Restored node modules for $PKG"
        else
            echo "Unable to restore cache for $PKG"
        fi
    done
}

restore_deps packages
restore_deps apps

```

- netlify-lerna-cache:

```
#!/bin/sh
NODE_MODULES_CACHE="./node_modules"
LERNA_CACHE="$NODE_MODULES_CACHE/lerna-cache"

mkdir -p "$NODE_MODULES_CACHE/lerna-cache"

cache_deps() {
    PACKAGES=$(ls -1 $1)

    for PKG in $PACKAGES
    do
        PKG_NODE_MODULES="$1/$PKG/node_modules"
        if [ -d $PKG_NODE_MODULES ];
        then
            mv $PKG_NODE_MODULES $LERNA_CACHE/$PKG
            echo "Cached node modules for $PKG"
        else
            echo "Unale to cache node modules for $PKG"
        fi
    done
}

cache_deps packages
cache_deps apps

```

The `netlify-lerna-restore` is used to move packages from root-level `node_modules`. It should be added to package.json's `preinstall` script. However, the script should be called only during the Netlify builds. I control this with `NETLIFY_RESTORE` env variable.

Here's part of my `package.json`:

```
{
  "name": "example",
  "version": "1.0.0",
  "main": "index.js",
  "license": "MIT",
  "devDependencies": {
    "lerna": "^3.20.2"
  },
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "lerna:cache": "[ $NETLIFY_RESTORE = 1 ] && ./netlify-lerna-cache || :",
    "lerna:restore": "[ $NETLIFY_RESTORE = 1 ] && ./netlify-lerna-restore || :",
    "preinstall": "yarn lerna:restore",
    "webapp:build": "cd apps/webapp && yarn build"
  },
	"private": true
}
```

The second script `netlify-lerna-cache` should be called AFTER your build.