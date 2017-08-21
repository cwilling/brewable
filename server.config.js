// Rollup plugins
import babel from 'rollup-plugin-babel';
import eslint from 'rollup-plugin-eslint';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import { minify } from 'uglify-es';


export default {
  entry: 'src/scripts/brewable.js',
  dest: 'build/js/brewableserverbundle.js',
  format: 'cjs',
  external: [ 'path', 'buffer', 'http', 'https', 'events', 'util', 'tty', 'net', 'url', 'fs', 'crypto' ],
  banner: '#!/usr/bin/env node',
  sourceMap: 'inline',
  plugins: [
    json(),
    resolve({
      main: true,
      preferBuiltins: true
    }),
    commonjs({
      include: 'node_modules/**',
      exclude: 'node_modules/rollup-plugin-node-builtins/**',
      nameExports: {
      }
    }),
    eslint({
      configFile: '/home/pi/src/brewable/.eslintrcserver.json',
      exclude: [
        'src/styles/**',
        'node_modules/**'
      ]
    }),
    babel({
      exclude: 'node_modules/**',
    }),
    replace({
      exclude: 'node_modules/**',
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    (process.env.NODE_ENV === 'production' && uglify({}, minify)),
  ]
};

