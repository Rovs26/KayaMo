import { PACKAGE as ai } from '@kayamo/ai';
import { PACKAGE as core } from '@kayamo/core';
import { PACKAGE as db } from '@kayamo/db';
import { PACKAGE as food } from '@kayamo/food';
import { PACKAGE as offline } from '@kayamo/offline';
import { PACKAGE as ui } from '@kayamo/ui';

export const workspacePackages = { ai, core, db, food, offline, ui } as const;
