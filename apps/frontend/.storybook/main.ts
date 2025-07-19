import type { StorybookConfig } from '@storybook/nextjs';

import { join, dirname } from 'path';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}
const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-onboarding'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/nextjs'),
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  webpackFinal: async (config) => {
    // Mock the hooks for Storybook
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '../hooks/useButtons': require.resolve('./mocks/hooks.js'),
      '../hooks/useDevices': require.resolve('./mocks/hooks.js'),
      '../hooks/useRealTimeEvents': require.resolve('./mocks/hooks.js'),
      '../../hooks/useButtons': require.resolve('./mocks/hooks.js'),
      '../../hooks/useDevices': require.resolve('./mocks/hooks.js'),
      '../../hooks/useRealTimeEvents': require.resolve('./mocks/hooks.js'),
    };
    return config;
  },
};
export default config;
