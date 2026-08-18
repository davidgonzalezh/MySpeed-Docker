import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faPlus} from "@fortawesome/free-solid-svg-icons";
import {useState, useRef, useLayoutEffect} from "react";
import {createPortal} from "react-dom";
import "./styles.sass";

const GAP = 8;

export const DropdownSelect = ({
    items,
    onSelect,
    buttonText,
    buttonIcon = faPlus,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({visibility: "hidden"});
    const containerRef = useRef(null);
    const menuRef = useRef(null);

    useLayoutEffect(() => {
        if (!isOpen) return;

        const place = () => {
            const button = containerRef.current.getBoundingClientRect();
            const above = button.top - GAP * 2;
            const below = window.innerHeight - button.bottom - GAP * 2;
            const dropUp = above >= menuRef.current.scrollHeight || above >= below;

            setPosition({
                top: dropUp ? undefined : button.bottom + GAP,
                bottom: dropUp ? window.innerHeight - button.top + GAP : undefined,
                right: window.innerWidth - button.right,
                maxHeight: dropUp ? above : below
            });
        };

        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);

        return () => {
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
        };
    }, [isOpen, items]);

    const handleBlur = (event) => {
        if (containerRef.current?.contains(event.relatedTarget) || menuRef.current?.contains(event.relatedTarget)) return;
        setIsOpen(false);
    };

    const handleSelect = (item) => {
        onSelect(item);
        setIsOpen(false);
    };

    const switchOpen = () => {
        setPosition({visibility: "hidden"});
        setIsOpen(!isOpen);
    };

    if (disabled) return null;

    return (
        <div className="dropdown-select-container" ref={containerRef} onBlur={handleBlur} tabIndex={-1}>
            <button className="dropdown-select-btn" onClick={switchOpen}>
                <FontAwesomeIcon icon={buttonIcon}/>
                <span>{buttonText}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`dropdown-select-chevron ${isOpen ? "rotated" : ""}`}/>
            </button>

            {isOpen && createPortal(
                <div className="dropdown-select-menu" ref={menuRef} style={position}>
                    {items.map((item, index) => (
                        <div key={item.key || index} className="dropdown-select-item" onClick={() => handleSelect(item)} tabIndex={0}>
                            {item.icon && <FontAwesomeIcon icon={item.icon}/>}
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>, document.body)}
        </div>
    );
};
