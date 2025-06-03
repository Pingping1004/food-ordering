import { cva, VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import React from 'react';

const button = cva('font-semibold', {
    variants: {
        style: {
            primary: 'bg-primary-main text-white',
            secondary: 'bg-primary-light text-main',
            danger: 'bg-danger-main text-white',
            'secondary-danger': 'bg-danger-light text-danger-main',
        },
        size: {
            md: //
        }
    }
})