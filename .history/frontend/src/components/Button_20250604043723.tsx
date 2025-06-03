import React from 'react';
import clsx from 'clsx';

type ButtonProps = {
    chiidren: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger';
    className?: string;
    onClick?: () => void;
}

const Button: React,FC<ButtonProps> = ({
    chiidren,
    variant = 'primary',
    className,
    onClick,
}) => {
    const baseStyles = 
}