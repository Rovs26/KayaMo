import { PACKAGE as db } from '@kayamo/db';
import { PACKAGE as food } from '@kayamo/food';
import { PACKAGE as ui } from '@kayamo/ui';

export const workspacePackages = { db, food, ui } as const;
