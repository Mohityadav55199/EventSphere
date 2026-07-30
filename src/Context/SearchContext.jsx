// context/SearchContext.jsx
import React, { createContext, useState, useContext } from "react";

const SearchContext = createContext();

export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
 const [filteredEvents, setFilteredEvents] = useState([]);

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery, filteredEvents, setFilteredEvents }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => useContext(SearchContext);
